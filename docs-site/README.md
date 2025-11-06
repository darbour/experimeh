# Experimeh Documentation Site

This directory contains the browsable documentation website for Experimeh.

## Structure

```
docs-site/
├── index.html          # Main landing page
├── guides.html         # Guide navigation page
├── styles.css          # Global styles
└── api/               # Auto-generated API documentation (not in git)
```

## Building the Documentation

### Prerequisites

Make sure you have installed all dependencies:

```bash
npm install
```

### Generate API Documentation

```bash
npm run docs:api
```

This will:
1. Run TypeDoc to generate API documentation from TypeScript source files
2. Output the generated documentation to `docs-site/api/`

### Build All Documentation

```bash
npm run docs:build
```

### Serve Locally

To preview the documentation site locally:

```bash
npm run docs:serve
```

This will start a local web server at `http://localhost:8080`

## Deployment

The documentation is automatically deployed to GitHub Pages when changes are pushed to the `main` branch.

The deployment workflow (`.github/workflows/deploy-docs.yml`) will:

1. Check out the code
2. Install dependencies
3. Build TypeScript code
4. Generate API documentation
5. Deploy to GitHub Pages

## Customization

### Styling

Edit `styles.css` to customize the appearance of the documentation site.

### Content

- **Landing Page**: Edit `index.html`
- **Guides Page**: Edit `guides.html`
- **API Documentation**: Controlled by `typedoc.json` configuration

### TypeDoc Configuration

The API documentation generation is configured in `typedoc.json`. Key settings:

- `entryPoints`: Source files to document
- `out`: Output directory
- `theme`: Documentation theme
- `excludePrivate`: Hide private members

## Technology Stack

- **TypeDoc**: Generates API documentation from TypeScript
- **HTML/CSS**: Static documentation site
- **GitHub Pages**: Hosting platform
- **GitHub Actions**: Automated deployment

## Links

- Documentation Site: https://darbour.github.io/experimeh/
- Repository: https://github.com/darbour/experimeh
- TypeDoc: https://typedoc.org/
