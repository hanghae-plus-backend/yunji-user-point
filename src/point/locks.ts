import { Injectable } from '@nestjs/common'

type ReleaseFunction = () => void
interface TaskWatingQueueItem {
    resolve: (release: ReleaseFunction) => void
    data: any
}

@Injectable()
export class Locks {
    private _taskWaitingQueue: Required<TaskWatingQueueItem>[] = []

    private _isLocked = false

    private _dispatch() {
        if (this._isLocked) {
            return
        }
        const nextTaskWaitngTicket = this._taskWaitingQueue.shift()
        if (!nextTaskWaitngTicket) {
            return
        }

        this._isLocked = true
        nextTaskWaitngTicket.resolve(() => {
            this._isLocked = false
            this._dispatch()
        })
    }

    private _acquireLock(data: any) {
        return new Promise<ReleaseFunction>(resolve => {
            this._taskWaitingQueue.push({ resolve, data })
            this._dispatch()
        })
    }

    private async _tryCallback<T>(
        callback: () => Promise<T>,
        maxRetries: number,
        retryDelay: number,
    ): Promise<T> {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await callback()
            } catch (error) {
                if (attempt === maxRetries) throw error
                await new Promise(resolve => setTimeout(resolve, retryDelay))
            }
        }
    }

    async executeOnLock<T>(
        callback: () => Promise<T>,
        data: any,
        maxRetries: number = 2,
        retryDelay: number = 3000,
    ) {
        const unlock = await this._acquireLock(data)
        try {
            return await this._tryCallback(callback, maxRetries, retryDelay)
        } catch (error) {
        } finally {
            unlock()
        }
    }
}
