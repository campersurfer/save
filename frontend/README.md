# Save App Frontend

Modern React-based frontend for the Save App personal finance management system.

## Features

- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **Framer Motion** for animations
- **React Query** for data fetching
- **React Router** for navigation
- **Lucide React** for icons

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start development server:
   ```bash
   npm run dev
   ```

3. Build for production:
   ```bash
   npm run build
   ```

4. Type checking:
   ```bash
   npm run type-check
   ```

## Architecture

- `/src/components` - Reusable UI components
- `/src/pages` - Route-based page components
- `/src/main.tsx` - Application entry point
- `/src/App.tsx` - Main app component with routing

## API Integration

The frontend is configured to proxy API requests to the backend server running on port 3001.

All API calls should be made to `/api/*` endpoints which will be automatically proxied to the backend.

## Docker Support

The frontend is fully containerized and integrated with the Docker and Kubernetes infrastructure:

- Development: Uses `Dockerfile.dev` with hot reload
- Production: Multi-stage build in main `Dockerfile`
- Served via Nginx in production with optimized static assets