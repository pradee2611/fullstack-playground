const { createClient } = require("@libsql/client");
const path = require("path");
const fs = require("fs").promises;
require("dotenv").config({ path: path.join(__dirname, "../.env.local") });

class DatabaseService {
  constructor() {
    const url = process.env.TURSO_DATABASE_URL || "file:../database.sqlite";
    const authToken = process.env.TURSO_AUTH_TOKEN;

    this.client = createClient({
      url,
      authToken,
    });

    this.initPromise = this.initializeTables();
  }

  async initializeTables() {
    await this.client.executeMultiple(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        problem_statement TEXT,
        tech_stack TEXT,
        user_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        workspace_path TEXT,
        is_completed INTEGER DEFAULT 0,
        completion_validated_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        content TEXT,
        is_directory INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        UNIQUE(project_id, file_path)
      );

      CREATE TABLE IF NOT EXISTS dependencies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT NOT NULL,
        package_name TEXT NOT NULL,
        version TEXT,
        type TEXT DEFAULT 'dependency',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        UNIQUE(project_id, package_name, type)
      );

      CREATE TABLE IF NOT EXISTS feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT NOT NULL,
        file_path TEXT,
        feedback_type TEXT NOT NULL,
        feedback_data TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS progress_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT NOT NULL,
        task_name TEXT NOT NULL,
        task_description TEXT,
        status TEXT DEFAULT 'pending',
        completed_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS agent_preferences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        agent_name TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        trigger_mode TEXT DEFAULT 'manual',
        preferences TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(project_id, user_id, agent_name)
      );

      CREATE INDEX IF NOT EXISTS idx_files_project ON files(project_id);
      CREATE INDEX IF NOT EXISTS idx_dependencies_project ON dependencies(project_id);
      CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
      CREATE INDEX IF NOT EXISTS idx_feedback_project ON feedback(project_id);
      CREATE INDEX IF NOT EXISTS idx_progress_tasks_project ON progress_tasks(project_id);
      CREATE INDEX IF NOT EXISTS idx_agent_preferences_project ON agent_preferences(project_id);
    `);

    try {
      await this.client.execute(
        `ALTER TABLE projects ADD COLUMN problem_statement TEXT`,
      );
    } catch (e) {}
    try {
      await this.client.execute(
        `ALTER TABLE projects ADD COLUMN is_completed INTEGER DEFAULT 0`,
      );
    } catch (e) {}
    try {
      await this.client.execute(
        `ALTER TABLE projects ADD COLUMN completion_validated_at DATETIME`,
      );
    } catch (e) {}
  }

  async createUser(userData) {
    await this.initPromise;
    const { id, email, password, name } = userData;
    await this.client.execute({
      sql: `INSERT INTO users (id, email, password, name) VALUES (?, ?, ?, ?)`,
      args: [id, email, password, name || ""],
    });
    return this.getUser(id);
  }

  async getUser(userId) {
    await this.initPromise;
    const result = await this.client.execute({
      sql: "SELECT id, email, name, created_at FROM users WHERE id = ?",
      args: [userId],
    });
    return result.rows[0];
  }

  async getUserByEmail(email) {
    await this.initPromise;
    const result = await this.client.execute({
      sql: "SELECT * FROM users WHERE email = ?",
      args: [email],
    });
    return result.rows[0];
  }

  async createProject(projectData) {
    await this.initPromise;
    const {
      id,
      name,
      description,
      problem_statement,
      tech_stack,
      user_id,
      workspace_path,
    } = projectData;
    await this.client.execute({
      sql: `INSERT INTO projects (id, name, description, problem_statement, tech_stack, user_id, workspace_path) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        name,
        description || "",
        problem_statement || "",
        tech_stack || "",
        user_id || "default",
        workspace_path,
      ],
    });
    return this.getProject(id);
  }

  async getProject(projectId) {
    await this.initPromise;
    const result = await this.client.execute({
      sql: "SELECT * FROM projects WHERE id = ?",
      args: [projectId],
    });
    return result.rows[0];
  }

  async getAllProjects(userId = "default") {
    await this.initPromise;
    const result = await this.client.execute({
      sql: "SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC",
      args: [userId],
    });
    return result.rows;
  }

  async updateProject(projectId, updates) {
    await this.initPromise;
    const fields = [];
    const values = [];

    if (updates.name !== undefined) {
      fields.push("name = ?");
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      fields.push("description = ?");
      values.push(updates.description);
    }
    if (updates.problem_statement !== undefined) {
      fields.push("problem_statement = ?");
      values.push(updates.problem_statement);
    }
    if (updates.tech_stack !== undefined) {
      fields.push("tech_stack = ?");
      values.push(updates.tech_stack);
    }
    if (updates.is_completed !== undefined) {
      fields.push("is_completed = ?");
      values.push(updates.is_completed ? 1 : 0);
    }
    if (updates.completion_validated_at !== undefined) {
      fields.push("completion_validated_at = ?");
      values.push(updates.completion_validated_at);
    }

    if (fields.length === 0) return this.getProject(projectId);

    fields.push("updated_at = CURRENT_TIMESTAMP");
    values.push(projectId);

    await this.client.execute({
      sql: `UPDATE projects SET \${fields.join(', ')} WHERE id = ?`,
      args: values,
    });
    return this.getProject(projectId);
  }

  async deleteProject(projectId) {
    await this.initPromise;
    return this.client.execute({
      sql: "DELETE FROM projects WHERE id = ?",
      args: [projectId],
    });
  }

  // ==================== Files ====================

  async createFile(projectId, filePath, content = "", isDirectory = false) {
    await this.initPromise;
    await this.client.execute({
      sql: `INSERT OR REPLACE INTO files (project_id, file_path, content, is_directory, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      args: [projectId, filePath, content, isDirectory ? 1 : 0],
    });
    return this.getFile(projectId, filePath);
  }

  async getFile(projectId, filePath) {
    await this.initPromise;
    const result = await this.client.execute({
      sql: "SELECT * FROM files WHERE project_id = ? AND file_path = ?",
      args: [projectId, filePath],
    });
    return result.rows[0];
  }

  async getFilesByProject(projectId, directory = null) {
    await this.initPromise;
    if (directory && directory !== "") {
      const pattern = directory.endsWith("/")
        ? `\${directory}%`
        : `\${directory}/%`;
      const excludePattern = `\${pattern}/%/%`;
      const result = await this.client.execute({
        sql: `SELECT * FROM files WHERE project_id = ? AND file_path LIKE ? AND file_path NOT LIKE ? ORDER BY is_directory DESC, file_path`,
        args: [projectId, pattern, excludePattern],
      });
      return result.rows;
    } else {
      const result = await this.client.execute({
        sql: `SELECT * FROM files WHERE project_id = ? AND (file_path NOT LIKE '%/%' OR file_path NOT LIKE '%/%/%') ORDER BY is_directory DESC, file_path`,
        args: [projectId],
      });
      return result.rows.filter((file) => {
        const parts = file.file_path.split("/");
        return parts.length === 1;
      });
    }
  }

  async updateFile(projectId, filePath, content) {
    await this.initPromise;
    await this.client.execute({
      sql: `UPDATE files SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE project_id = ? AND file_path = ?`,
      args: [content, projectId, filePath],
    });
    return this.getFile(projectId, filePath);
  }

  async deleteFile(projectId, filePath) {
    await this.initPromise;
    const pattern = filePath.endsWith("/") ? `\${filePath}%` : `\${filePath}/%`;
    return this.client.execute({
      sql: `DELETE FROM files WHERE project_id = ? AND (file_path = ? OR file_path LIKE ?)`,
      args: [projectId, filePath, pattern],
    });
  }

  // ==================== Dependencies ====================

  async addDependency(projectId, packageName, version, type = "dependency") {
    await this.initPromise;
    await this.client.execute({
      sql: `INSERT OR REPLACE INTO dependencies (project_id, package_name, version, type) VALUES (?, ?, ?, ?)`,
      args: [projectId, packageName, version, type],
    });
    return this.getDependency(projectId, packageName, type);
  }

  async getDependency(projectId, packageName, type = "dependency") {
    await this.initPromise;
    const result = await this.client.execute({
      sql: `SELECT * FROM dependencies WHERE project_id = ? AND package_name = ? AND type = ?`,
      args: [projectId, packageName, type],
    });
    return result.rows[0];
  }

  async getDependencies(projectId) {
    await this.initPromise;
    const result = await this.client.execute({
      sql: `SELECT * FROM dependencies WHERE project_id = ? ORDER BY type, package_name`,
      args: [projectId],
    });
    return result.rows;
  }

  async removeDependency(projectId, packageName, type = "dependency") {
    await this.initPromise;
    return this.client.execute({
      sql: `DELETE FROM dependencies WHERE project_id = ? AND package_name = ? AND type = ?`,
      args: [projectId, packageName, type],
    });
  }

  // ==================== Sync with File System ====================

  async syncProjectToFileSystem(projectId) {
    await this.initPromise;
    const project = await this.getProject(projectId);
    if (!project || !project.workspace_path) {
      throw new Error("Project or workspace path not found");
    }

    const workspacePath = project.workspace_path;
    await fs.mkdir(workspacePath, { recursive: true });

    const result = await this.client.execute({
      sql: "SELECT * FROM files WHERE project_id = ?",
      args: [projectId],
    });
    const files = result.rows;

    for (const file of files) {
      if (file.is_directory) {
        await fs.mkdir(path.join(workspacePath, file.file_path), {
          recursive: true,
        });
      } else {
        const filePath = path.join(workspacePath, file.file_path);
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(filePath, file.content || "", "utf8");
      }
    }

    const dependencies = await this.getDependencies(projectId);
    if (dependencies.length > 0) {
      const packageJson = {
        name: project.name.toLowerCase().replace(/\s+/g, "-"),
        version: "1.0.0",
        description: project.description || "",
        dependencies: {},
        devDependencies: {},
      };

      for (const dep of dependencies) {
        if (dep.type === "devDependency") {
          packageJson.devDependencies[dep.package_name] =
            dep.version || "latest";
        } else {
          packageJson.dependencies[dep.package_name] = dep.version || "latest";
        }
      }

      const packageJsonPath = path.join(workspacePath, "package.json");
      await fs.writeFile(
        packageJsonPath,
        JSON.stringify(packageJson, null, 2),
        "utf8",
      );
    }
  }

  async syncFileSystemToDatabase(projectId) {
    await this.initPromise;
    const project = await this.getProject(projectId);
    if (!project || !project.workspace_path) {
      return;
    }

    const workspacePath = project.workspace_path;

    try {
      await fs.access(workspacePath);
    } catch (error) {
      console.log(`Workspace path does not exist: \${workspacePath}`);
      return;
    }

    const scanDirectory = async (dirPath, relativePath = "") => {
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          if (
            entry.name === "node_modules" ||
            entry.name === ".git" ||
            entry.name === ".next"
          ) {
            continue;
          }

          const fullPath = path.join(dirPath, entry.name);
          const filePath = relativePath
            ? `\${relativePath}/\${entry.name}`
            : entry.name;

          if (entry.isDirectory()) {
            await this.createFile(projectId, filePath, "", true);
            await scanDirectory(fullPath, filePath);
          } else {
            try {
              const content = await fs.readFile(fullPath, "utf8");
              await this.createFile(projectId, filePath, content, false);
            } catch (readError) {
              await this.createFile(projectId, filePath, "", false);
            }
          }
        }
      } catch (error) {
        console.error(`Error scanning directory \${dirPath}:`, error.message);
      }
    };

    try {
      await scanDirectory(workspacePath);
      console.log(`Synced file system to database for project \${projectId}`);
    } catch (error) {
      console.error("Error syncing file system to database:", error);
    }
  }

  // ==================== Feedback & Learning ====================

  async createFeedback(feedbackData) {
    await this.initPromise;
    const { project_id, file_path, feedback_type, feedback_data } =
      feedbackData;
    const result = await this.client.execute({
      sql: `INSERT INTO feedback (project_id, file_path, feedback_type, feedback_data) VALUES (?, ?, ?, ?) RETURNING id`,
      args: [
        project_id,
        file_path || null,
        feedback_type,
        JSON.stringify(feedback_data),
      ],
    });
    const lastId = result.rows[0].id; // RETURNING provides the ID
    return this.getFeedback(lastId);
  }

  async getFeedback(feedbackId) {
    await this.initPromise;
    const result = await this.client.execute({
      sql: "SELECT * FROM feedback WHERE id = ?",
      args: [feedbackId],
    });
    const feedback = result.rows[0];
    if (feedback) {
      try {
        feedback.feedback_data = JSON.parse(feedback.feedback_data);
      } catch (e) {}
    }
    return feedback;
  }

  async getFeedbackByProject(projectId) {
    await this.initPromise;
    const result = await this.client.execute({
      sql: "SELECT * FROM feedback WHERE project_id = ? ORDER BY created_at DESC",
      args: [projectId],
    });
    return result.rows.map((f) => {
      try {
        f.feedback_data = JSON.parse(f.feedback_data);
      } catch (e) {}
      return f;
    });
  }

  // ==================== Progress Tracking ====================

  async createProgressTask(taskData) {
    await this.initPromise;
    const { project_id, task_name, task_description, status } = taskData;
    const result = await this.client.execute({
      sql: `INSERT INTO progress_tasks (project_id, task_name, task_description, status) VALUES (?, ?, ?, ?) RETURNING id`,
      args: [
        project_id,
        task_name,
        task_description || "",
        status || "pending",
      ],
    });
    return this.getProgressTask(result.rows[0].id);
  }

  async getProgressTask(taskId) {
    await this.initPromise;
    const result = await this.client.execute({
      sql: "SELECT * FROM progress_tasks WHERE id = ?",
      args: [taskId],
    });
    return result.rows[0];
  }

  async getProgressTasksByProject(projectId) {
    await this.initPromise;
    const result = await this.client.execute({
      sql: "SELECT * FROM progress_tasks WHERE project_id = ? ORDER BY created_at ASC",
      args: [projectId],
    });
    return result.rows;
  }

  async updateProgressTask(taskId, updates) {
    await this.initPromise;
    const fields = [];
    const values = [];

    if (updates.status !== undefined) {
      fields.push("status = ?");
      values.push(updates.status);
      if (updates.status === "completed") {
        fields.push("completed_at = CURRENT_TIMESTAMP");
      }
    }
    if (updates.task_name !== undefined) {
      fields.push("task_name = ?");
      values.push(updates.task_name);
    }
    if (updates.task_description !== undefined) {
      fields.push("task_description = ?");
      values.push(updates.task_description);
    }

    if (fields.length === 0) return this.getProgressTask(taskId);

    values.push(taskId);

    await this.client.execute({
      sql: `UPDATE progress_tasks SET \${fields.join(', ')} WHERE id = ?`,
      args: values,
    });
    return this.getProgressTask(taskId);
  }

  // ==================== Agent Preferences ====================

  async setAgentPreference(preferenceData) {
    await this.initPromise;
    const {
      project_id,
      user_id,
      agent_name,
      enabled,
      trigger_mode,
      preferences,
    } = preferenceData;
    await this.client.execute({
      sql: `INSERT OR REPLACE INTO agent_preferences (project_id, user_id, agent_name, enabled, trigger_mode, preferences, updated_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      args: [
        project_id,
        user_id,
        agent_name,
        enabled ? 1 : 0,
        trigger_mode || "manual",
        JSON.stringify(preferences || {}),
      ],
    });
    return this.getAgentPreference(project_id, user_id, agent_name);
  }

  async getAgentPreference(projectId, userId, agentName) {
    await this.initPromise;
    const result = await this.client.execute({
      sql: "SELECT * FROM agent_preferences WHERE project_id = ? AND user_id = ? AND agent_name = ?",
      args: [projectId, userId, agentName],
    });
    const pref = result.rows[0];
    if (pref) {
      try {
        pref.preferences = JSON.parse(pref.preferences);
      } catch (e) {}
    }
    return pref;
  }

  async getAgentPreferencesByProject(projectId, userId) {
    await this.initPromise;
    const result = await this.client.execute({
      sql: "SELECT * FROM agent_preferences WHERE project_id = ? AND user_id = ?",
      args: [projectId, userId],
    });
    return result.rows.map((p) => {
      try {
        p.preferences = JSON.parse(p.preferences);
      } catch (e) {}
      return p;
    });
  }
}

module.exports = new DatabaseService();
