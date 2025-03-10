# SpotiSpot Project Information

This file contains useful information about the SpotiSpot project to help with development and maintenance.

## Common Commands

- **Start development server**: `npm run dev`
- **Type checking**: `npm run typecheck`
- **Build for production**: `npm run build`
- **Prisma commands**:
  - Update database schema: `npx prisma db push`
  - Generate Prisma client: `npx prisma generate`

## Project Structure

- **Frontend**: React with React Router v7
- **Database**: Prisma ORM with SQLite (can be changed to other backends)
- **Styling**: Tailwind CSS

## Application Features

SpotiSpot is a web application that allows users to create "placelists" - playlists of MP3s tied to specific geographic locations. Key features include:

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
- The data structure for placelists is defined in `schema.prisma`
- The player compass interface is in `/app/routes/play/$sessionId.tsx`

## Development Tips

- When testing geolocation features, you may need to enable location services in your browser
- For mobile testing, use `--host` flag when running the dev server: `npm run dev -- --host`
- To modify the database schema, update `schema.prisma` and run `npx prisma db push`