import { Injectable } from '@nestjs/common'
import { PointHistoryTable } from '../database/pointhistory.table'
import { UserPointTable } from '../database/userpoint.table'
import { PointHistory, TransactionType, UserPoint } from './point.model'
import { Locks } from './locks'
import { NotEnoughPointsError } from './error/NotEnoughPointsError'
import { UserNotFoundError } from './error/UserNotFoundError'

@Injectable()
export class PointService {
    constructor(
        private readonly locks: Locks,
        private readonly userDb: UserPointTable,
        private readonly historyDb: PointHistoryTable,
    ) {}

    async getUserPoint(id: number): Promise<UserPoint> {
        const selectResult = await this.userDb.selectById(id)
        if (!selectResult) {
            throw new UserNotFoundError('User Not Found')
        }
        return selectResult
    }

    async getUserPointHistory(id: number): Promise<PointHistory[]> {
        const selectResult = await this.historyDb.selectAllByUserId(id)
        if (!selectResult) {
            throw new UserNotFoundError('User Not Found')
        }
        return selectResult
    }

    async chargeUserPoint(id: number, amount: number): Promise<UserPoint> {
        let currentPoint: UserPoint
        let updateResultUserDB: UserPoint
        await this.locks.executeOnLock(
            async () => {
                try {
                    currentPoint = await this.userDb.selectById(id)
                    if (!currentPoint) {
                        throw new UserNotFoundError('User Not Found')
                    }
                } catch (error) {
                    throw error
                }

                try {
                    updateResultUserDB = await this.userDb.insertOrUpdate(
                        id,
                        currentPoint.point + amount,
                    )
                } catch (error) {
                    throw error
                }

                try {
                    const {
                        id: resultId,
                        point,
                        updateMillis,
                    } = updateResultUserDB

                    let updateResultHistoryDB: PointHistory
                    const transactionType = TransactionType.CHARGE

                    updateResultHistoryDB = await this.historyDb.insert(
                        resultId,
                        point,
                        transactionType,
                        updateMillis,
                    )
                } catch (error) {
                    updateResultUserDB = await this.userDb.insertOrUpdate(
                        id,
                        currentPoint.point,
                    )
                    throw error
                }
            },
            { userId: id, amount },
        )

        return updateResultUserDB
    }

    async useUserPoint(id: number, amount: number): Promise<UserPoint> {
        let currentPoint: UserPoint
        let updateResultUserDB: UserPoint
        let updateResultHistoryDB: PointHistory
        await this.locks.executeOnLock(
            async () => {
                try {
                    currentPoint = await this.userDb.selectById(id)
                } catch (error) {
                    throw error
                }

                if (currentPoint.point >= amount) {
                    try {
                        updateResultUserDB = await this.userDb.insertOrUpdate(
                            id,
                            currentPoint.point - amount,
                        )
                    } catch (error) {
                        throw error
                    }

                    try {
                        const {
                            id: resultId,
                            point,
                            updateMillis,
                        } = updateResultUserDB
                        const transactionType = TransactionType.USE

                        updateResultHistoryDB = await this.historyDb.insert(
                            resultId,
                            point,
                            transactionType,
                            updateMillis,
                        )
                    } catch (error) {
                        updateResultUserDB = await this.userDb.insertOrUpdate(
                            id,
                            currentPoint.point,
                        )
                        throw error
                    }
                } else {
                    throw new NotEnoughPointsError('Not enough points')
                }
            },
            { userId: id, amount },
        )

        return updateResultUserDB
    }
}
