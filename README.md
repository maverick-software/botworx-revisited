# Gofr Agents - Agent Creation & Collaboration Platform

Gofr Agents allows users to create, configure, and manage AI agents via a web UI. These agents can collaborate within Workspaces, interact with Discord, leverage external tools (MCP), and access knowledge bases (RAG).

## 📚 Documentation

All documentation has been organized into topic-specific guides in the **[README folder](README/)** for better navigation and maintenance.

**📖 [Start Here: Complete Documentation Index](README/index.md)**

### 🚀 Quick Links
- **[Windows Desktop](README/windows-desktop.md)** - Private Electron application, local PostgreSQL/Supabase runtime, installation, providers, and recovery
- **[Getting Started](README/getting-started.md)** - Installation, setup, and first steps
- **[Project Overview](README/project-overview.md)** - Features, architecture, and tech stack
- **[Tool Infrastructure](README/tool-infrastructure.md)** - MCP tool development and integration guide
- **[Security Updates](README/security-updates.md)** - Critical security information and compliance
- **[Integrations](README/integrations.md)** - Email, tools, and external services
- **[Database Schema](README/database-schema.md)** - Complete database architecture
- **[Deployment Guide](README/deployment.md)** - Production deployment instructions

### 🎯 Quick Start
```bash
# Clone and install
git clone <repository-url>
cd gofr-agents
npm install

# Set up environment
cp .env.example .env
# Edit .env with your Supabase credentials

# Start development server
npm run dev
```

For detailed setup instructions, see the **[Getting Started Guide](README/getting-started.md)**.

## 📊 Project Status

**Status**: Production-Ready with Active Development  
**Last Updated**: October 4, 2025  
**Documentation Version**: 2.2 (Universal MCP System)

### ✅ Production-Ready Features
- Complete agent management and workspace collaboration
- Enterprise-grade security with Supabase Vault integration
- Comprehensive email integrations (Gmail, Outlook, SMTP, SendGrid, Mailgun)
- **Universal MCP Platform**: Connect to ANY MCP-compliant server (Zapier, Retell AI, Anthropic, OpenAI, custom)
- **MCP Tool Infrastructure**: Scalable Model Context Protocol implementation with auto-detection
- Contact management system with agent-based permissions
- Advanced task scheduling and multi-step workflows
- **Temporary Chat Links**: Anonymous public chat links for employee check-ins, customer support, and feedback collection
- Professional UI with light/dark theme support

### 🎉 Recent Updates (October 2025)
- **Universal MCP System**: Transformed from Zapier-only to support ANY MCP-compliant server
- **Automatic Server Detection**: Server type, capabilities, and protocol version auto-detected on connection
- **Health Monitoring**: Real-time connection health tracking for all MCP servers
- **Tool Toggle System**: Complete UI-based control over tool availability with secure defaults
- **Advanced Reasoning**: Production-ready with dynamic enable/disable functionality

### 🔄 Active Development
- Enhanced Microsoft 365 integration (Teams, OneDrive)
- MCP Management Interface completion
- Performance optimizations and scaling improvements

For detailed status information, see **[Current Status](README/current-status.md)**.

## 🤝 Contributing

We welcome contributions! Please see our documentation for:
- **[Development Setup](README/getting-started.md)** - Environment setup and installation
- **[Architecture Overview](README/project-overview.md)** - Understanding the codebase
- **[Tool Infrastructure](README/tool-infrastructure.md)** - MCP tool development and integration
- **[Security Guidelines](README/security-updates.md)** - Security best practices

### 🛠️ For Tool Developers

Gofr Agents uses a sophisticated MCP (Model Context Protocol) infrastructure that makes it easy to add new tools and integrations:

- **Universal Tool Execution**: Single pathway for all tool types with automatic routing
- **Dynamic Discovery**: Tools are automatically discovered and registered based on permissions  
- **Scalable Architecture**: Add new tools without modifying core chat functionality
- **Complete Documentation**: Step-by-step guides for tool development and deployment

**[📖 Read the Tool Infrastructure Guide](README/tool-infrastructure.md)** for complete information on developing, registering, and deploying MCP tools.

## 📞 Support

- **Documentation**: **[README folder](README/)** contains comprehensive guides for all topics
- **Issues**: Report bugs and feature requests via GitHub issues
- **Security**: Review **[Security Updates](README/security-updates.md)** for security practices

---

**For complete documentation, visit the [README folder](README/) or start with the [Documentation Index](README/index.md).**
