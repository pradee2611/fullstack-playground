const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const dockerManager = require('./dockerManager');

class PortProxy {
  constructor() {
    this.app = express();
    this.proxies = new Map(); // containerId -> proxy middleware
    this.portMappings = new Map(); // workspaceId -> { containerPort, hostPort, url }
  }

  /**
   * Create proxy for container port
   */
  createProxy(workspaceId, containerPort, hostPort) {
    const proxyUrl = `http://localhost:${hostPort}`;
    
    const proxy = createProxyMiddleware({
      target: proxyUrl,
      changeOrigin: true,
      ws: true, // WebSocket support
      logLevel: 'silent',
      onProxyReq: (proxyReq, req, res) => {
        // Add custom headers if needed
        proxyReq.setHeader('X-Workspace-Id', workspaceId);
      },
      onError: (err, req, res) => {
        console.error(`Proxy error for workspace ${workspaceId}:`, err.message);
        res.status(502).json({ error: 'Proxy error' });
      },
    });

    this.proxies.set(workspaceId, proxy);
    
    // Store mapping
    this.portMappings.set(workspaceId, {
      containerPort,
      hostPort,
      url: proxyUrl,
      previewUrl: `/preview/${workspaceId}/${containerPort}`,
    });

    return proxy;
  }

  /**
   * Get preview URL for workspace
   */
  getPreviewUrl(workspaceId, containerPort) {
    const mapping = this.portMappings.get(workspaceId);
    if (mapping && mapping.containerPort === containerPort) {
      return mapping.previewUrl;
    }
    return null;
  }

  /**
   * Remove proxy
   */
  removeProxy(workspaceId) {
    this.proxies.delete(workspaceId);
    this.portMappings.delete(workspaceId);
  }

  /**
   * Setup proxy routes on Express app
   */
  setupRoutes(app) {
    // Preview route: /preview/:workspaceId/:port
    app.use('/preview/:workspaceId/:port', (req, res, next) => {
      const { workspaceId, port } = req.params;
      const proxy = this.proxies.get(workspaceId);
      
      if (proxy) {
        proxy(req, res, next);
      } else {
        res.status(404).json({ error: 'Preview not found' });
      }
    });

    // Health check for preview
    app.get('/preview/:workspaceId/health', (req, res) => {
      const { workspaceId } = req.params;
      const mapping = this.portMappings.get(workspaceId);
      
      if (mapping) {
        res.json({
          success: true,
          workspaceId,
          ...mapping,
        });
      } else {
        res.status(404).json({ error: 'Preview not found' });
      }
    });
  }

  /**
   * Auto-detect and expose port from container
   */
  async autoExposePort(workspaceId, commonPorts = [3000, 5173, 8000, 8080, 5000]) {
    const containerInfo = await dockerManager.getContainer(workspaceId);
    if (!containerInfo) {
      return null;
    }

    // Try to detect which port the app is using
    // This is a simplified version - in production, you'd check container logs or network
    for (const port of commonPorts) {
      try {
        const mapping = await dockerManager.exposePort(workspaceId, port);
        this.createProxy(workspaceId, port, mapping.hostPort);
        return {
          containerPort: port,
          hostPort: mapping.hostPort,
          previewUrl: `/preview/${workspaceId}/${port}`,
        };
      } catch (error) {
        // Port might not be in use, try next
        continue;
      }
    }

    return null;
  }
}

module.exports = new PortProxy();




