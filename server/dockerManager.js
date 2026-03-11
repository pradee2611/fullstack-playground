const Docker = require('dockerode');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs').promises;

class DockerManager {
  constructor() {
    try {
      this.docker = new Docker();
      this.available = true;
      console.log('Docker is available');
    } catch (error) {
      this.docker = null;
      this.available = false;
      console.warn('Docker not available, using local file system');
    }
    
    this.containers = new Map(); // workspaceId -> container info
    this.portMappings = new Map(); // containerId -> port mappings
  }

  async createContainer(workspaceId, options = {}) {
    if (!this.available) {
      throw new Error('Docker is not available');
    }

    const {
      image = 'node:18',
      memory = '2g',
      cpus = '1',
      env = {},
      volumes = [],
    } = options;

    // Create volume for workspace
    const volumeName = `workspace-${workspaceId}`;
    const workspacePath = path.join(__dirname, '../workspaces', workspaceId);
    
    // Ensure workspace directory exists
    await fs.mkdir(workspacePath, { recursive: true });

    // Create container
    const container = await this.docker.createContainer({
      Image: image,
      Cmd: ['/bin/bash'],
      Tty: true,
      OpenStdin: true,
      StdinOnce: false,
      AttachStdout: true,
      AttachStderr: true,
      AttachStdin: true,
      HostConfig: {
        Memory: this.parseMemory(memory),
        CpuShares: this.parseCpus(cpus),
        Binds: [
          `${workspacePath}:/workspace`,
          ...volumes,
        ],
        PortBindings: {},
        AutoRemove: false,
      },
      WorkingDir: '/workspace',
      Env: [
        ...Object.entries(env).map(([k, v]) => `${k}=${v}`),
        'TERM=xterm-256color',
        'COLORTERM=truecolor',
      ],
    });

    await container.start();

    const containerInfo = {
      id: container.id,
      workspaceId,
      container,
      image,
      createdAt: new Date(),
      ports: {},
    };

    this.containers.set(workspaceId, containerInfo);

    // Inspect container to get port mappings
    const inspect = await container.inspect();
    if (inspect.NetworkSettings?.Ports) {
      containerInfo.ports = inspect.NetworkSettings.Ports;
    }

    console.log(`Container created for workspace ${workspaceId}: ${container.id}`);
    return containerInfo;
  }

  async getContainer(workspaceId) {
    const info = this.containers.get(workspaceId);
    if (info) {
      // Verify container still exists
      try {
        await info.container.inspect();
        return info;
      } catch (error) {
        // Container was removed, clean up
        this.containers.delete(workspaceId);
        return null;
      }
    }
    return null;
  }

  async execCommand(workspaceId, command, options = {}) {
    const containerInfo = await this.getContainer(workspaceId);
    if (!containerInfo) {
      throw new Error(`Container not found for workspace ${workspaceId}`);
    }

    const exec = await containerInfo.container.exec({
      Cmd: ['/bin/bash', '-c', command],
      AttachStdout: true,
      AttachStderr: true,
      WorkingDir: '/workspace',
      ...options,
    });

    return exec;
  }

  async attachTerminal(workspaceId) {
    const containerInfo = await this.getContainer(workspaceId);
    if (!containerInfo) {
      throw new Error(`Container not found for workspace ${workspaceId}`);
    }

    // Create exec instance for interactive shell
    const exec = await containerInfo.container.exec({
      Cmd: ['/bin/bash'],
      AttachStdout: true,
      AttachStderr: true,
      AttachStdin: true,
      Tty: true,
      WorkingDir: '/workspace',
    });

    return exec;
  }

  async exposePort(workspaceId, containerPort, hostPort = null) {
    const containerInfo = await this.getContainer(workspaceId);
    if (!containerInfo) {
      throw new Error(`Container not found for workspace ${workspaceId}`);
    }

    // If hostPort not provided, find available port
    if (!hostPort) {
      hostPort = await this.findAvailablePort();
    }

    // Stop container to modify port bindings
    await containerInfo.container.stop();

    // Get current port bindings
    const inspect = await containerInfo.container.inspect();
    const currentPorts = inspect.HostConfig?.PortBindings || {};

    // Add new port binding
    currentPorts[`${containerPort}/tcp`] = [{ HostPort: hostPort.toString() }];

    // Update container with new port bindings
    // Note: Docker doesn't support dynamic port updates, so we need to recreate
    // For production, use a reverse proxy instead
    await containerInfo.container.start();

    // Store port mapping
    if (!this.portMappings.has(containerInfo.id)) {
      this.portMappings.set(containerInfo.id, {});
    }
    const mappings = this.portMappings.get(containerInfo.id);
    mappings[containerPort] = hostPort;

    return { containerPort, hostPort };
  }

  async findAvailablePort() {
    // Simple port finder - in production, use a proper port manager
    const startPort = 3000;
    const endPort = 4000;
    
    for (let port = startPort; port < endPort; port++) {
      const inUse = Array.from(this.portMappings.values())
        .some(mappings => Object.values(mappings).includes(port));
      
      if (!inUse) {
        return port;
      }
    }
    
    throw new Error('No available ports');
  }

  async stopContainer(workspaceId) {
    const containerInfo = this.containers.get(workspaceId);
    if (containerInfo) {
      try {
        await containerInfo.container.stop();
        console.log(`Container stopped for workspace ${workspaceId}`);
      } catch (error) {
        console.error(`Error stopping container: ${error.message}`);
      }
    }
  }

  async removeContainer(workspaceId) {
    const containerInfo = this.containers.get(workspaceId);
    if (containerInfo) {
      try {
        await containerInfo.container.stop();
        await containerInfo.container.remove();
        this.containers.delete(workspaceId);
        this.portMappings.delete(containerInfo.id);
        console.log(`Container removed for workspace ${workspaceId}`);
      } catch (error) {
        console.error(`Error removing container: ${error.message}`);
      }
    }
  }

  async cleanupInactiveContainers(maxAgeMinutes = 60) {
    const now = new Date();
    const toRemove = [];

    for (const [workspaceId, info] of this.containers.entries()) {
      const ageMinutes = (now - info.createdAt) / (1000 * 60);
      if (ageMinutes > maxAgeMinutes) {
        toRemove.push(workspaceId);
      }
    }

    for (const workspaceId of toRemove) {
      await this.removeContainer(workspaceId);
    }

    return toRemove.length;
  }

  parseMemory(memory) {
    // Convert memory string (e.g., "2g", "512m") to bytes
    const match = memory.match(/^(\d+)([gm])$/i);
    if (!match) return 2 * 1024 * 1024 * 1024; // Default 2GB
    
    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    
    if (unit === 'g') return value * 1024 * 1024 * 1024;
    if (unit === 'm') return value * 1024 * 1024;
    return value;
  }

  parseCpus(cpus) {
    // Convert CPU count to CPU shares (1024 = 1 CPU)
    const cpuCount = parseFloat(cpus);
    return Math.floor(cpuCount * 1024);
  }

  isAvailable() {
    return this.available;
  }
}

module.exports = new DockerManager();




