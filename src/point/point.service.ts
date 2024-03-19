import { Injectable } from '@nestjs/common'
import { PointHistoryTable } from '../database/pointhistory.table'
import { UserPointTable } from '../database/userpoint.table'
import { TransactionType, UserPoint } from './point.model'

@Injectable()
export class PointService {
    constructor(
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
        const updateResultUserDB = await this.userDb.insertOrUpdate(id, amount)
        const { id: resultId, point, updateMillis } = updateResultUserDB
        const transactionType: TransactionType = 0
        await this.historyDb.insert(
            resultId,
            point,
            transactionType,
            updateMillis,
        )
        return updateResultUserDB
    }

    async useUserPoint(id: number, amount: number): Promise<UserPoint> {
        const updateResultUserDB = await this.userDb.insertOrUpdate(id, amount)
        const { id: resultId, point, updateMillis } = updateResultUserDB
        const transactionType: TransactionType = 1
        await this.historyDb.insert(
            resultId,
            point,
            transactionType,
            updateMillis,
        )
        return updateResultUserDB
    }
}
