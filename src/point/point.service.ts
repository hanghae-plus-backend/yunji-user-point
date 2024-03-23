import { Injectable } from '@nestjs/common'
import { PointHistoryTable } from '../database/pointhistory.table'
import { UserPointTable } from '../database/userpoint.table'
import { PointHistory, TransactionType, UserPoint } from './point.model'
import { Locks } from './locks'

@Injectable()
export class PointService {
    constructor(
        private readonly locks: Locks,
        private readonly userDb: UserPointTable,
        private readonly historyDb: PointHistoryTable,
    ) {}

    getUserPoint(id: number) {
        return this.userDb.selectById(id)
    }

    getUserPointHistory(id: number) {
        return this.historyDb.selectAllByUserId(id)
    }

    async chargeUserPoint(id: number, amount: number): Promise<UserPoint> {
        let updateResultUserDB: UserPoint
        await this.locks.executeOnLock(
            async () => {
                const currentPoint = await this.userDb.selectById(id)

                updateResultUserDB = await this.userDb.insertOrUpdate(
                    id,
                    currentPoint.point + amount,
                )

                const { id: resultId, point, updateMillis } = updateResultUserDB

                let updateResultHistoryDB: PointHistory
                const transactionType = TransactionType.CHARGE

                updateResultHistoryDB = await this.historyDb.insert(
                    resultId,
                    point,
                    transactionType,
                    updateMillis,
                )
            },
            { userId: id, amount },
        )

        return updateResultUserDB
    }

    async useUserPoint(id: number, amount: number): Promise<UserPoint> {
        let updateResultUserDB: UserPoint
        let updateResultHistoryDB: PointHistory
        await this.locks.executeOnLock(
            async () => {
                const currentPoint = await this.userDb.selectById(id)

                if (currentPoint.point >= amount) {
                    updateResultUserDB = await this.userDb.insertOrUpdate(
                        id,
                        currentPoint.point - amount,
                    )

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
                } else {
                    throw new Error('Not enough points')
                }
            },
            { userId: id, amount },
        )

        return updateResultUserDB
    }
}
