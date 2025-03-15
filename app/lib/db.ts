import { PrismaClient } from '@prisma/client/edge'
import { withAccelerate } from '@prisma/extension-accelerate'

let prisma = new PrismaClient().$extends(withAccelerate())

export { prisma }

// List of adjectives and nouns for codename generation
export const adjectives1 = [
  "fluffy", "shiny", "happy", "clever", "brave", "mighty", "friendly", "gentle", 
  "peaceful", "calm", "bright", "wild", "lovely", "cozy", "swift", "vibrant"
];

export const adjectives2 = [
  "ornate", "elegant", "curious", "playful", "majestic", "thoughtful", "caring",
  "radiant", "magical", "graceful", "dazzling", "delightful", "enchanted", "harmonious"
];

export const nouns = [
  "bunny", "panda", "tiger", "dolphin", "falcon", "dragon", "phoenix", "unicorn",
  "turtle", "koala", "fox", "wolf", "squirrel", "butterfly", "eagle", "lion"
];

// Helper function to generate a random codename
function generateCodename() {
  const randomAdj1 = adjectives1[Math.floor(Math.random() * adjectives1.length)];
  const randomAdj2 = adjectives2[Math.floor(Math.random() * adjectives2.length)];
  const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];

  return {
    codenameAdjective1: randomAdj1,
    codenameAdjective2: randomAdj2,
    codenameNoun: randomNoun,
    name: `${randomAdj1} ${randomAdj2} ${randomNoun}`
  };
}

// User management functions
export async function createUser() {
  const codename = generateCodename();
  
  const user = await prisma.user.create({
    data: {
      ...codename
    }
  });
  
  return {
    ...user,
    codename: `${codename.codenameAdjective1} ${codename.codenameAdjective2} ${codename.codenameNoun}`
  };
}

export async function getUserByCodename(
  adj1: string,
  adj2: string,
  noun: string
) {
  return prisma.user.findFirst({
    where: {
      codenameAdjective1: adj1.toLowerCase(),
      codenameAdjective2: adj2.toLowerCase(),
      codenameNoun: noun.toLowerCase()
    }
  });
}

export async function getUserById(id: string) {
  return prisma.user.findUnique({
    where: { id }
  });
}

// Helper functions for working with placelists
export async function createPlacelist(data: {
  name: string
  description?: string
  items: Array<{ location: { lat: number; lng: number }; spotifyUrl: string }>
  authorId: string
}) {
  return prisma.placelist.create({
    data: {
      name: data.name,
      description: data.description,
      items: data.items,
      authorId: data.authorId
    },
  })
}

export async function getPlacelist(id: string) {
  return prisma.placelist.findUnique({
    where: { id },
    include: { author: true }
  })
}

export async function getAllPlacelists() {
  return prisma.placelist.findMany({
    orderBy: { createdAt: "desc" },
    include: { author: true }
  })
}

export async function getPlacelistsByUser(userId: string) {
  // Get placelists created by this user
  const placelists = await prisma.placelist.findMany({
    where: { authorId: userId },
    orderBy: { createdAt: "desc" },
    include: { 
      author: true,
      sessions: true 
    }
  });

  // For each placelist, count the sessions by status
  return placelists.map(placelist => {
    const items = placelist.items as any[];
    const totalItems = items.length;
    
    // Count sessions by status
    const sessionStats = {
      total: placelist.sessions.length,
      completed: 0,
      inProgress: 0,
      saved: 0
    };
    
    // Calculate stats for each session
    placelist.sessions.forEach(session => {
      // Count sessions with a user ID as saved
      if (session.userId) {
        sessionStats.saved++;
      }
      
      // Count completed vs. in-progress
      if (session.progress >= totalItems) {
        sessionStats.completed++;
      } else if (session.progress > 0) {
        sessionStats.inProgress++;
      }
    });
    
    // Return placelist with stats
    return {
      ...placelist,
      sessionStats
    };
  });
}

export async function deletePlacelist(id: string) {
  return prisma.placelist.delete({
    where: { id },
  })
}

export async function updatePlacelist(
  id: string,
  data: {
    name?: string
    description?: string
    items?: Array<{ location: { lat: number; lng: number }; spotifyUrl: string }>
  }
) {
  return prisma.placelist.update({
    where: { id },
    data,
  })
}

// Session management
export async function createSession(placelistId: string) {
  return prisma.userSession.create({
    data: {
      placelistId,
    },
  })
}

export async function getSession(id: string) {
  return prisma.userSession.findUnique({
    where: { id },
    include: { placelist: true },
  })
}

export async function updateSessionProgress(id: string, progress: number) {
  return prisma.userSession.update({
    where: { id },
    data: { progress },
  })
}

export async function associateSessionWithUser(sessionId: string, userId: string) {
  return prisma.userSession.update({
    where: { id: sessionId },
    data: { userId },
    include: { user: true }
  })
}

export async function getSessionWithUser(id: string) {
  return prisma.userSession.findUnique({
    where: { id },
    include: { placelist: true, user: true },
  })
}

export async function getUserSessions(userId: string) {
  return prisma.userSession.findMany({
    where: { userId },
    include: { placelist: true },
    orderBy: { updatedAt: 'desc' }
  })
}

// Get all user sessions grouped by completion status
export async function getUserSessionsGrouped(userId: string) {
  // Get all user's placelists to know the total items count
  const userSessions = await prisma.userSession.findMany({
    where: { userId },
    include: { 
      placelist: {
        include: {
          author: true
        }
      }
    },
    orderBy: { updatedAt: 'desc' }
  });

  // Group sessions based on completion status
  const inProgressSessions = [];
  const completedSessions = [];

  for (const session of userSessions) {
    // Get the items length to determine if the session is complete
    const items = session.placelist.items as any[];
    const totalItems = items.length;
    
    if (session.progress >= totalItems) {
      completedSessions.push(session);
    } else {
      inProgressSessions.push(session);
    }
  }

  return {
    inProgressSessions,
    completedSessions
  };
}