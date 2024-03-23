import { Test, TestingModule } from '@nestjs/testing'
import { PointService } from './point.service'
import { UserPointTable } from '../database/userpoint.table'
import { PointHistoryTable } from '../database/pointhistory.table'
import { PointHistory, TransactionType, UserPoint } from './point.model'
import { Locks } from './locks'
import { UserNotFoundError } from './error/UserNotFoundError'
import { NotEnoughPointsError } from './error/NotEnoughPointsError'

describe('PointService', () => {
    const userId = 1
    const initPoint = 1000
    const maxRetriesCaseFailure = 2
    const retryDelayCaseFailure = 3000

    const initSetUser = () => {
        let mockUserPointTable: Map<number, UserPoint> = new Map()
        let mockPointHistoryTable: Map<number, PointHistory[]> = new Map()

        const now = Date.now()

        mockUserPointTable.set(1, {
            id: userId,
            point: initPoint,
            updateMillis: now,
        })

        mockPointHistoryTable.set(1, [
            {
                id: 1,
                userId: userId,
                amount: initPoint,
                type: TransactionType.CHARGE,
                timeMillis: now,
            },
        ])

        return { mockUserPointTable, mockPointHistoryTable }
    }

    const userPointTableMockImplementations = (
        mockUserPointTable: Map<number, UserPoint>,
    ) => {
        return {
            selectById: jest
                .fn()
                .mockImplementation(async (id: number) =>
                    mockUserPointTable.get(id),
                ),
            insertOrUpdate: jest
                .fn()
                .mockImplementation(async (id: number, amount: number) => {
                    const userPoint: UserPoint = {
                        id: id,
                        point: amount,
                        updateMillis: Date.now(),
                    }
                    mockUserPointTable.set(id, userPoint)
                    return userPoint
                }),
        }
    }

    const pointHistoryTableMockImplementations = (
        mockPointHistoryTable: Map<number, PointHistory[]>,
    ) => {
        return {
            selectAllByUserId: jest
                .fn()
                .mockImplementation(async id => mockPointHistoryTable.get(id)),
            insert: jest
                .fn()
                .mockImplementation(
                    async (
                        userId: number,
                        amount: number,
                        transactionType: TransactionType,
                        updateMillis: number,
                    ) => {
                        const history = mockPointHistoryTable.get(userId) ?? []
                        const newHistory: PointHistory = {
                            id: history.length + 1,
                            userId: userId,
                            amount: amount,
                            type: transactionType,
                            timeMillis: updateMillis,
                        }
                        mockPointHistoryTable.set(userId, [
                            ...history,
                            newHistory,
                        ])
                        return newHistory
                    },
                ),
        }
    }

    describe('PointHistory DB Insert 정상 작동시', () => {
        let service: PointService

        beforeEach(async () => {
            let { mockUserPointTable, mockPointHistoryTable } = initSetUser()
            const moduleRef: TestingModule = await Test.createTestingModule({
                providers: [
                    PointService,
                    Locks,
                    {
                        provide: UserPointTable,
                        useValue:
                            userPointTableMockImplementations(
                                mockUserPointTable,
                            ),
                    },
                    {
                        provide: PointHistoryTable,
                        useValue: pointHistoryTableMockImplementations(
                            mockPointHistoryTable,
                        ),
                    },
                ],
            }).compile()

            service = moduleRef.get<PointService>(PointService)
        })

        test('service가 정상적으로 로드됨', () => {
            expect(service).toBeDefined()
        })

        describe('getUserPoint', () => {
            test('포인트가 정상적으로 조회됨', async () => {
                const result = await service.getUserPoint(userId)
                expect(result.point).toBe(initPoint)
            })

            test(
                '존재하지 않는 유저로 조회시 UserNotFoundError 발생',
                async () => {
                    expect(service.getUserPoint(2)).rejects.toThrow(
                        UserNotFoundError,
                    )
                },
                maxRetriesCaseFailure * retryDelayCaseFailure + 5000,
            )
        })

        describe('getUserPointHistory', () => {
            test('포인트 내역이 정상적으로 조회됨', async () => {
                const result = await service.getUserPointHistory(userId)
                expect(result).toHaveLength(1)
                expect(result).toEqual(
                    expect.arrayContaining([
                        expect.objectContaining({
                            userId: 1,
                            amount: initPoint,
                            type: 0,
                            timeMillis: expect.any(Number),
                        }),
                    ]),
                )
            })

            test(
                '존재하지 않는 유저로 조회시 UserNotFoundError 발생',
                async () => {
                    expect(service.getUserPointHistory(2)).rejects.toThrow(
                        UserNotFoundError,
                    )
                },
                maxRetriesCaseFailure * retryDelayCaseFailure + 5000,
            )
        })

        describe('chargeUserPoint', () => {
            test('포인트가 정상적으로 충전됨', async () => {
                const tryAmount = 100
                const result = await service.chargeUserPoint(userId, tryAmount)
                expect(result.point).toBe(initPoint + tryAmount)
            })

            test(
                '존재하지 않는 유저로 시도시 UserNotFoundError 발생',
                async () => {
                    expect(service.chargeUserPoint(2, 100)).rejects.toThrow(
                        UserNotFoundError,
                    )
                },
                maxRetriesCaseFailure * retryDelayCaseFailure + 5000,
            )
        })

        describe('useUserPoint', () => {
            test('포인트가 정상적으로 사용됨', async () => {
                const tryAmount = 100
                const result = await service.useUserPoint(userId, tryAmount)
                expect(result.point).toBe(initPoint - tryAmount)
            })

            test(
                '존재하지 않는 유저로 시도시 UserNotFoundError 발생',
                async () => {
                    expect(service.chargeUserPoint(2, 100)).rejects.toThrow(
                        UserNotFoundError,
                    )
                },
                maxRetriesCaseFailure * retryDelayCaseFailure + 5000,
            )

            test(
                '현재 포인트 잔액보다 높은 포인트를 사용하려 시도할 시 에러 발생',
                async () => {
                    expect(
                        service.useUserPoint(1, initPoint * 2),
                    ).rejects.toThrow(NotEnoughPointsError)
                },
                maxRetriesCaseFailure * retryDelayCaseFailure + 5000,
            )

            test('같은 유저의 포인트 사용을 동시에 실행 시 순차 처리 후 잔액 부족 시 에러 발생', async () => {
                const tryAmount = 300
                const usePromises = []

                for (let i = 0; i < 10; i++) {
                    usePromises.push(service.useUserPoint(userId, tryAmount))
                }

                const results = await Promise.allSettled(usePromises)

                const successResponses = results.filter(
                    result => result.status === 'fulfilled',
                )

                expect(successResponses.length).toBeLessThanOrEqual(
                    Math.floor(initPoint / tryAmount),
                )
            }, 60000)
        })
    })

    describe('PointHistory DB Insert 비정상 작동시', () => {
        let service: PointService
        let userDb: UserPointTable

        beforeEach(async () => {
            let { mockUserPointTable, mockPointHistoryTable } = initSetUser()
            const moduleRef: TestingModule = await Test.createTestingModule({
                providers: [
                    PointService,
                    Locks,
                    {
                        provide: UserPointTable,
                        useValue:
                            userPointTableMockImplementations(
                                mockUserPointTable,
                            ),
                    },
                    {
                        provide: PointHistoryTable,
                        useValue: {
                            ...pointHistoryTableMockImplementations(
                                mockPointHistoryTable,
                            ),
                            insert: jest
                                .fn()
                                .mockRejectedValue(new Error('DB error')),
                        },
                    },
                ],
            }).compile()

            service = moduleRef.get<PointService>(PointService)
            userDb = moduleRef.get<UserPointTable>(UserPointTable)
        })

        test('service가 정상적으로 로드됨', () => {
            expect(service).toBeDefined()
        })

        describe('chargeUserPoint', () => {
            test('히스토리 입력 실패 시 포인트 롤백됨', async () => {
                const tryAmount = 100
                await expect(
                    service.chargeUserPoint(userId, tryAmount),
                ).rejects.toThrow('DB error')

                expect(userDb.insertOrUpdate).toHaveBeenLastCalledWith(
                    userId,
                    initPoint,
                )
            })
        })

        describe('useUserPoint', () => {
            test('히스토리 입력 실패 시 포인트 롤백됨', async () => {
                const tryAmount = 100
                await expect(
                    service.useUserPoint(userId, tryAmount),
                ).rejects.toThrow('DB error')

                expect(userDb.insertOrUpdate).toHaveBeenLastCalledWith(
                    userId,
                    initPoint,
                )
            })
        })
    })
})
