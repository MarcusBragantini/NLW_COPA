import { FastifyInstance } from "fastify"
import { prisma } from "../lib/prisma"
import { z } from 'zod';
import ShortUniqueId from 'short-unique-id';
import { authenticate } from "../plugins/authenticate";

export async function poolRoutes(fastify: FastifyInstance) {

    fastify.get('/pools/count', async () => {
        const count = await prisma.pool.count()
        return { count }
    })

    fastify.post('/pools', async (request, reply) => {

        const createPollBody = z.object({
            title: z.string()
        })

        const { title } = createPollBody.parse(request.body);

        const generate = new ShortUniqueId({ length: 6 })
        const code = new String(generate()).toUpperCase()

        try {
            await request.jwtVerify()
            await prisma.pool.create({
                data: {
                    title,
                    code,
                    ownerId: request.user.sub,

                    participants: {
                        create: {
                            userId: request.user.sub,
                        }
                    }
                }
            })
        } catch (error) {
            await prisma.pool.create({
                data: {
                    title,
                    code
                }
            })
        }


        return reply.status(201).send({ code })

    })

    fastify.post('/pools/join',
    { onRequest: [authenticate] },
    async (request, reply) => {

        const joinPoolBody = z.object({
            code: z.string()
        })

        const { code } = joinPoolBody.parse(request.body)

        const pool = await prisma.pool.findUnique({
            where: {
                code
            },
            include: {
                participants: {
                    where: {
                        userId: request.user.sub,
                    }
                }
            }
        })

        if (!pool) {
            reply.status(400).send({
                message: 'Pool not found.'
            })
        }

        if (pool && pool.participants.length > 0) {
            reply.status(400).send({
                message: 'You already joined this pool.'
            })
        }

        if (pool && !pool.ownerId) {
            await prisma.pool.update({
                where: {
                    id: pool.id,
                },
                data: {
                    ownerId: request.user.sub,
                }
            })
        }

       pool && await prisma.participant.create({
            data: {
                poolId: pool.id,
                userId: request.user.sub,
            }
        })

        return reply.status(201).send()
    })

    fastify.get('/pools', {
        onRequest: [authenticate],
    },
    async (request) => {
        const pools = await prisma.pool.findMany({
            where: {
                participants: {
                    some: {
                        userId: request.user.sub,
                    }
                }
            },
            include: {
                owner: {
                    select: {
                        id: true,
                        name: true,
                    }
                },
                participants: {
                    select: {
                        id: true,

                        user: {
                            select: {
                                avatarUrl: true,
                            }
                        }
                    },
                    take: 4,
                },
                _count: {
                    select: {
                        participants: true,
                    }
                }
            }
        })

        return { pools }
    })

    fastify.get('/pools/:id', {
        onRequest: [authenticate],
    },
    async (request) => {

        const getPollParams = z.object({
            id: z.string(),
        })

        const { id } = getPollParams.parse(request.params)

        const pool = await prisma.pool.findUnique({
            where: {
                id,
            },
            include: {
                owner: {
                    select: {
                        id: true,
                        name: true,
                    }
                },
                participants: {
                    select: {
                        id: true,

                        user: {
                            select: {
                                avatarUrl: true,
                            }
                        }
                    },
                    take: 4,
                },
                _count: {
                    select: {
                        participants: true,
                    }
                }
            }
        })

        return { pool }
    })


}