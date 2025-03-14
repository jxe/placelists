# SpotiSpot Project Information

This file contains useful information about the SpotiSpot project to help with development and maintenance.

## Common Commands

- **Start development server**: `npm run dev` or `bun run dev`
- **Type checking**: `npm run typecheck` or `bun run typecheck`
- **Build for production**: `npm run build` or `bun run build`
- **Package management**: 
  - Install packages: `bun add <package-name>`
  - Install dev dependencies: `bun add -D <package-name>`
- **Prisma commands**:
  - Update database schema: `npx prisma db push`
  - Generate Prisma client: `npx prisma generate`

## Project Structure

- **Frontend**: React with React Router v7
- **Database**: Prisma ORM with SQLite (can be changed to other backends)
- **Styling**: Tailwind CSS with shadcn/ui components
- **Maps**: Google Maps integration for location selection

## Application Features

SpotiSpot is a web application that allows users to create "placelists" - playlists of MP3s tied to specific geographic locations. Key features include:

- User authentication with memorable codename system (no passwords)
- Create, view, edit, and delete placelists
- Each placelist contains alternating latitude/longitude coordinates and Spotify links
- Generate shareable player URLs that use geolocation to guide users to each location
- Compass and distance tracker to help users navigate to each point
- Automatic unlocking of songs when users reach the specified locations (within 25 meters)
- Tracking of user progress through placelists

## Codebase Notes

- The app uses React Router v7 with the file-based routing system
- Geolocation functions are located in `app/lib/utils.ts`
- Database interactions are abstracted in `app/lib/db.ts`
- Authentication logic is in `app/lib/session.ts`
- The data structure for placelists and users is defined in `schema.prisma`
- The player compass interface is in `/app/routes/play/$sessionId.tsx`
- Authentication routes are in `/app/routes/auth/`
- The PlacelistEditor component supports:
  - Text mode: raw text editing of placelist coordinates and Spotify URLs
  - Preview mode: visual editor with drag-and-drop reordering, map location picker
- UI components from shadcn/ui are located in `app/components/ui/`
- Google Maps integration via @react-google-maps/api for location selection
- Drag and drop functionality via @dnd-kit libraries

## Development Tips

- When testing geolocation features, you may need to enable location services in your browser
- For mobile testing, use `--host` flag when running the dev server: `npm run dev -- --host`
- To modify the database schema, update `schema.prisma` and run `npx prisma db push`
- For location selection, you'll need a valid Google Maps API key in your environment variables (GOOGLE_MAPS_API_KEY)
- When using CommonJS modules like @dnd-kit, import with wildcard syntax: `import * as dndKit from '@dnd-kit/core'`

## Authentication System

The app uses a codename-based authentication system with these characteristics:

- Users authenticate using a three-part codename (two adjectives + animal noun)
- Codenames are like "Fluffy Ornate Bunny" - easy to remember, no passwords needed
- The login screen uses dropdown selectors for each part of the codename
- New users get a randomly generated codename shown on the welcome screen
- User sessions are managed via cookies with the session module in `app/lib/session.ts`
- All routes under `/placelists` are protected and require authentication
- Placelists are tied to the user who created them and can only be edited by that user

## Coding Guidelines

### Component Structure
- Break down complex components into smaller, focused subcomponents
- For larger components like `PlacelistEditor`, extract reusable parts:
  - Each interactive element should be its own component where possible
  - Map functionality should be encapsulated in specific components
  - Form interfaces should be separated from list display interfaces

### State Management
- Lift state up to the appropriate level to avoid prop drilling
- Use local component state for UI interactions
- Use route loaders for data fetching
- Keep form state managed within form components when possible

### Authentication Patterns
- Use the `requireUser` helper from `app/lib/session.ts` in loader functions
- Check for ownership in both loaders and actions for protected routes
- Always validate user identity in each route action that modifies data
- Pass redirect URLs via URLSearchParams when redirecting to login

### Styling Approach
- Use Tailwind utility classes for component styling
- Follow mobile-first approach with responsive variants (sm:, md:, etc.)
- Use semantic color names from the Tailwind palette (green-500, gray-200, etc.)
- Group related UI elements with consistent spacing (gap-4, space-y-6, etc.)

## Lessons Learned

### Component Organization
- Embedding interactive elements (like maps) directly within their parent context improves UX
- Using state to toggle between different interface modes is cleaner than conditional prop passing
- Splitting large components improves maintainability and reduces errors

### User Experience
- Dropdown selectors for codename parts are more user-friendly than text input
- Welcome pages with important information help users remember critical details
- Field validation and clear error messages improve form usability
- Clear visual hierarchy with proper spacing improves readability

### Technical Implementation
- React Router's loaders and actions provide a clean separation of data fetching and mutations
- Cookie-based sessions work well for authentication without additional complexity
- Reusing interfaces (like the MapPicker) across different components improves consistency
- Using proper TypeScript interfaces improves code reliability