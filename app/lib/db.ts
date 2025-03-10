import { PrismaClient } from '@prisma/client/edge'
import { withAccelerate } from '@prisma/extension-accelerate'

let prisma = new PrismaClient().$extends(withAccelerate())

export { prisma }

// Helper functions for working with placelists
export async function createPlacelist(data: {
  name: string
  description?: string
  items: Array<{ location: { lat: number; lng: number }; spotifyUrl: string }>
}) {
  return prisma.placelist.create({
    data: {
      name: data.name,
      description: data.description,
      items: data.items,
    },
  })
}

export async function getPlacelist(id: string) {
  return prisma.placelist.findUnique({
    where: { id },
  })
}

export async function getAllPlacelists() {
  return prisma.placelist.findMany({
    orderBy: { createdAt: "desc" },
  })
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