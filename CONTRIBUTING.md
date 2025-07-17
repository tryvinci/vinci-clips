# Contributing to Vinci Clips

Thank you for your interest in contributing to Vinci Clips! We welcome contributions from the community and appreciate your help in making this project better.

## 🚀 Quick Start for Contributors

### Development Setup

1. **Fork and clone the repository:**
   ```bash
   git clone https://github.com/your-username/vinci-clips.git
   cd vinci-clips
   ```

2. **Install dependencies:**
   ```bash
   npm run install:all
   ```

3. **Set up environment variables:**
   Copy `backend/.env.example` to `backend/.env` and fill in your values:
   ```bash
   cp backend/.env.example backend/.env
   ```

4. **Start development servers:**
   ```bash
   npm start
   ```

## 🛠️ Development Guidelines

### Code Style

- **Frontend:** TypeScript with ESLint and Prettier
- **Backend:** JavaScript with JSDoc comments
- **Formatting:** Use Prettier for consistent code formatting
- **Linting:** Run `npm run lint` before submitting

### Git Workflow

1. **Create a feature branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes with clear commit messages:**
   ```bash
   git commit -m "feat: add video thumbnail generation"
   ```

3. **Push and create a pull request:**
   ```bash
   git push origin feature/your-feature-name
   ```

### Commit Message Format

We use conventional commits:
- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

## 🐛 Reporting Issues

### Bug Reports

When reporting bugs, please include:

1. **Environment information:**
   - OS and version
   - Node.js version
   - Browser (if frontend issue)

2. **Steps to reproduce:**
   - Clear, numbered steps
   - Expected vs actual behavior
   - Screenshots or videos if helpful

3. **Relevant logs:**
   - Backend logs from `backend/logs/`
   - Browser console errors
   - Network requests (if applicable)

### Feature Requests

For new features:
- Describe the problem you're trying to solve
- Explain why this feature would be valuable
- Provide examples or mockups if possible
- Consider implementation complexity

## 🔧 Areas for Contribution

### High Priority
- **Bug fixes:** Address issues in the GitHub issue tracker
- **Performance improvements:** Optimize video processing pipeline
- **Test coverage:** Add unit and integration tests
- **Documentation:** Improve setup guides and API docs

### Medium Priority
- **UI/UX improvements:** Enhance user interface and experience
- **New platform integrations:** Add support for more video platforms
- **Mobile responsiveness:** Improve mobile web experience
- **Error handling:** Better error messages and recovery

### Advanced Features
- **Auto-reframing:** AI-powered aspect ratio adjustment
- **Caption generation:** Automated subtitle creation
- **B-roll integration:** Context-aware supplementary content
- **Social media publishing:** Direct platform publishing

## 🧪 Testing

### Running Tests

```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test

# Run all tests
npm run test:all
```

### Writing Tests

- **Unit tests:** Test individual functions and components
- **Integration tests:** Test API endpoints and data flow
- **E2E tests:** Test complete user workflows

## 📋 Pull Request Process

### Before Submitting

1. **Code quality checks:**
   ```bash
   npm run lint
   npm run test
   ```

2. **Update documentation:**
   - Add JSDoc comments for new functions
   - Update README if needed
   - Include inline code comments for complex logic

3. **Test your changes:**
   - Test locally with the full development setup
   - Verify both frontend and backend functionality
   - Check edge cases and error handling

### PR Description Template

```markdown
## Description
Brief description of changes and motivation.

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated if needed
- [ ] No console.log statements left in code
```

## 🏗️ Architecture Guidelines

### Backend
- **Modular routes:** Keep route handlers focused and small
- **Error handling:** Use try-catch blocks and proper error responses
- **Logging:** Use the Winston logger for all output
- **Validation:** Validate all input data thoroughly

### Frontend
- **Component structure:** Keep components small and reusable
- **Type safety:** Use TypeScript interfaces and types
- **State management:** Use React state patterns appropriately
- **Performance:** Optimize renders and API calls

### Database
- **Schema design:** Use Mongoose schemas with proper validation
- **Indexing:** Add database indexes for query performance
- **Data consistency:** Ensure data integrity across operations

## 💡 Getting Help

### Community Support
- **GitHub Issues:** Ask questions using the "question" label
- **Documentation:** Check the README and wiki first
- **Code examples:** Look at existing implementations

### Contact
- **Maintainers:** Tag @maintainer-username in issues
- **Email:** For security issues, email security@tryvinci.com

## 🎯 Development Priorities

Current focus areas (updated regularly):

1. **Stability:** Fix existing bugs and improve error handling
2. **Performance:** Optimize video processing and API response times
3. **Testing:** Increase test coverage across the codebase
4. **Documentation:** Improve developer experience with better docs

## 📜 Code of Conduct

### Our Standards

**Positive behavior includes:**
- Using welcoming and inclusive language
- Being respectful of differing viewpoints and experiences
- Gracefully accepting constructive criticism
- Focusing on what is best for the community

**Unacceptable behavior includes:**
- Harassment, discrimination, or inappropriate comments
- Publishing others' private information without permission
- Trolling, insulting, or derogatory comments
- Professional misconduct

### Enforcement

Instances of abusive, harassing, or otherwise unacceptable behavior may be reported to the community leaders responsible for enforcement. All complaints will be reviewed and investigated promptly and fairly.

---

Thank you for contributing to Vinci Clips! Your efforts help make video content creation more accessible and powerful for everyone.