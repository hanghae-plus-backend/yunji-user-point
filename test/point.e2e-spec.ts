import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import * as request from 'supertest'
import { PointModule } from '../src/point/point.module'

describe('Point', () => {
    let app: INestApplication
    const userId = 1
    const initAmount = 1000
    const maxRetriesCaseFailure = 2
    const retryDelayCaseFailure = 3000

    beforeEach(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [PointModule],
        }).compile()

        app = moduleFixture.createNestApplication()
        await app.init()

        await request(app.getHttpServer())
            .patch(`/point/${userId}/charge`)
            .send({ amount: initAmount })
    })

    describe('/point/:id (GET)', () => {
        test('실행시 정상적으로 유저의 포인트를 조회함', async () => {
            const response = await request(app.getHttpServer()).get('/point/1')

            expect(response.statusCode).toBe(200)
            expect(response.body).toEqual({
                id: userId,
                point: initAmount,
                updateMillis: expect.any(Number),
            })
        })
    })

    describe('/point/:id/histories (GET)', () => {
        test('실행시 정상적으로 유저의 포인트 내역을 조회함', async () => {
            const response = await request(app.getHttpServer()).get(
                `/point/${userId}/histories`,
            )

            expect(response.statusCode).toBe(200)
            expect(response.body).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        userId: userId,
                        amount: initAmount,
                        type: 0,
                        timeMillis: expect.any(Number),
                        id: expect.any(Number),
                    }),
                ]),
            )
        })

        describe('/point/:id/charge (PATCH)', () => {
            test('실행시 정상적으로 유저의 포인트를 충전함', async () => {
                const response = await request(app.getHttpServer())
                    .patch(`/point/${userId}/charge`)
                    .send({ amount: 100 })

                expect(response.statusCode).toBe(200)
                expect(response.body).toEqual({
                    id: userId,
                    point: initAmount + 100,
                    updateMillis: expect.any(Number),
                })
            })

            test('유효하지 않는 값으로 충전 시도 시 에러 발생', async () => {
                const response = await request(app.getHttpServer())
                    .patch(`/point/${userId}/charge`)
                    .send({ amount: null })

                expect(response.status).toBe(400)
            })

            test('음수 값으로 충전 시도 시 에러 발생', async () => {
                const response = await request(app.getHttpServer())
                    .patch(`/point/${userId}/charge`)
                    .send({ amount: -10 })

                expect(response.status).toBe(400)
            })
        })

        describe('/point/:id/use (PATCH)', () => {
            test('실행시 정상적으로 유저의 포인트를 사용함', async () => {
                const tryAmount = 50
                const response = await request(app.getHttpServer())
                    .patch(`/point/${userId}/use`)
                    .send({ amount: tryAmount })

                expect(response.statusCode).toBe(200)
                expect(response.body).toEqual({
                    id: userId,
                    point: initAmount - tryAmount,
                    updateMillis: expect.any(Number),
                })
            })

            test(
                '현재 포인트 잔액보다 높은 포인트를 사용하려 시도할 시 에러 발생',
                async () => {
                    const response = await request(app.getHttpServer())
                        .patch(`/point/${userId}/use`)
                        .send({ amount: initAmount * 5 })

                    expect(response.status).toBe(400)
                },
                maxRetriesCaseFailure * retryDelayCaseFailure + 5000,
            )

            test(
                '유효하지 않는 아이디로 사용 시도 시 에러 발생',
                async () => {
                    const response = await request(app.getHttpServer())
                        .patch(`/point/0/use`)
                        .send({ amount: 50 })

                    expect(response.status).toBe(400)
                    expect(response.body.message).toBe(
                        'id is must be positive number.',
                    )
                },
                maxRetriesCaseFailure * retryDelayCaseFailure + 5000,
            )

            test('유효하지 않는 값으로 충전 시도 시 에러 발생', async () => {
                const response = await request(app.getHttpServer())
                    .patch(`/point/${userId}/use`)
                    .send({ amount: null })

                expect(response.status).toBe(400)
            })

            test('음수 값으로 사용 시도 시 에러 발생', async () => {
                const response = await request(app.getHttpServer())
                    .patch(`/point/${userId}/use`)
                    .send({ amount: -10 })

                expect(response.status).toBe(400)
            })

            test(
                '같은 유저의 포인트 사용을 동시에 실행 시 순차 처리 후 잔액 부족 시 에러 발생',
                async () => {
                    const tryAmount = 300
                    const usePromises = []

                    for (let i = 0; i < 10; i++) {
                        usePromises.push(
                            request(app.getHttpServer())
                                .patch(`/point/${userId}/use`)
                                .send({ amount: tryAmount }),
                        )
                    }

                    const results = await Promise.allSettled(usePromises)

                    const successResponses = results.filter(
                        result =>
                            result.status === 'fulfilled' &&
                            result.value.statusCode === 200,
                    )

                    expect(successResponses.length).toBeLessThanOrEqual(
                        Math.floor(initAmount / tryAmount),
                    )
                },
                maxRetriesCaseFailure * retryDelayCaseFailure * 10,
            )

            test('다른 유저의 포인트 사용을 동시에 실행 시 정상 처리', async () => {
                const anotherUser = userId + 1
                await request(app.getHttpServer())
                    .patch(`/point/${anotherUser}/charge`)
                    .send({ amount: 1000 })

                const usePromises = []
                usePromises.push(
                    request(app.getHttpServer())
                        .patch(`/point/${userId}/use`)
                        .send({ amount: 300 }),
                )
                usePromises.push(
                    request(app.getHttpServer())
                        .patch(`/point/${anotherUser}/use`)
                        .send({ amount: 300 }),
                )

                const results = await Promise.allSettled(usePromises)

                const successResponses = results.filter(
                    result =>
                        result.status === 'fulfilled' &&
                        result.value.statusCode === 200,
                )
                expect(successResponses).toHaveLength(2)
            })
        })

        afterAll(async () => {
            await app.close()
        })
    })
})
