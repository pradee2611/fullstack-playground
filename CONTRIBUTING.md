# Contributing to Cloud Workspace Platform

Thank you for your interest in contributing! This document provides guidelines for contributing to the project.

## Getting Started

1. Fork the repository
2. Clone your fork
3. Install dependencies: `npm install`
4. Create a new branch: `git checkout -b feature/your-feature-name`
5. Make your changes
6. Test your changes
7. Commit your changes: `git commit -m "Add your feature"`
8. Push to your fork: `git push origin feature/your-feature-name`
9. Open a Pull Request

## Development Guidelines

### Code Style

- Use TypeScript for all new code
- Follow the existing code style
- Use meaningful variable and function names
- Add comments for complex logic

### Component Structure

- Keep components focused and single-purpose
- Use TypeScript interfaces for props
- Extract reusable logic into custom hooks
- Use CSS modules for component styles

### Testing

- Test your changes locally
- Ensure the app builds without errors: `npm run build`
- Test all affected features

## Adding New Features

### Project Templates

To add a new project template:

1. Edit `components/ProjectSelector.tsx`
2. Add your template to the `projectTemplates` array
3. Include all necessary files in the `files` object
4. Set appropriate `port` and `startCommand`

### Terminal Commands

To add new terminal commands:

1. Edit `server/index.js`
2. Add your command handler in the `executeCommand` function
3. Update the help text

### AI Mentor

To customize AI behavior:

1. Edit `app/api/ai/chat/route.ts`
2. Modify the system prompt
3. Adjust message type detection logic

## Reporting Issues

When reporting issues, please include:

- Description of the issue
- Steps to reproduce
- Expected behavior
- Actual behavior
- Browser/OS information
- Screenshots (if applicable)

## Questions?

Feel free to open an issue for questions or discussions!




