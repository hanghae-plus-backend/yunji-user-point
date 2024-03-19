import { Test, TestingModule } from '@nestjs/testing'
import { PointService } from './point.service'
import { DatabaseModule } from '../database/database.module'

describe('PointService', () => {
    let service: PointService

    beforeEach(async () => {
        const moduleRef: TestingModule = await Test.createTestingModule({
            providers: [PointService],
            imports: [DatabaseModule],
        }).compile()

        service = moduleRef.get<PointService>(PointService)
        await service.chargeUserPoint(1, 500)
    })

    test('service가 정상적으로 로드됨', () => {
        expect(service).toBeDefined()
    })

    describe('getUserPoint', () => {
        test('포인트가 정상적으로 조회됨', async () => {
            const result = await service.getUserPoint(1)
            expect(result.point).toBe(500)
        })

        test('포인트 충전 후 조회 시 정상적으로 반영됨', async () => {
            await service.chargeUserPoint(1, 100)
            const result = await service.getUserPoint(1)
            expect(result.point).toBe(600)
        })

        test('포인트 사용 후 조회 시 정상적으로 반영됨', async () => {
            await service.useUserPoint(1, 100)
            const result = await service.getUserPoint(1)
            expect(result.point).toBe(400)
        })
    })

    describe('getUserPointHistory', () => {
        test('포인트 내역이 정상적으로 조회됨', async () => {
            const result = await service.getUserPointHistory(1)
            expect(result).toHaveLength(1)
            expect(result).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        userId: 1,
                        amount: 500,
                        type: 0,
                        timeMillis: expect.any(Number),
                    }),
                ]),
            )
        })

        test('포인트 사용 후 내역 조회 시 정상적으로 반영됨', async () => {
            await service.useUserPoint(1, 100)
            const result = await service.getUserPointHistory(1)
            expect(result).toHaveLength(2)
            expect(result).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        userId: 1,
                        amount: 500,
                        type: 0,
                        timeMillis: expect.any(Number),
                    }),
                    expect.objectContaining({
                        userId: 1,
                        amount: 400,
                        type: 1,
                        timeMillis: expect.any(Number),
                    }),
                ]),
            )
        })
    })

    describe('chargeUserPoint', () => {
        test('포인트가 정상적으로 충전됨', async () => {
            const result = await service.chargeUserPoint(1, 100)
            expect(result.point).toBe(600)
        })
    })

    describe('useUserPoint', () => {
        test('포인트가 정상적으로 사용됨', async () => {
            const result = await service.useUserPoint(1, 100)
            expect(result.point).toBe(400)
        })

        test('현재 포인트 잔액보다 높은 포인트를 사용하려 시도할 시 에러 발생', async () => {
            expect(service.useUserPoint(1, 1000)).rejects.toThrow(Error)
        })
    })
})
