export class NotEnoughPointsError extends Error {
    constructor(msg: string) {
        super(msg)
        Object.setPrototypeOf(this, NotEnoughPointsError.prototype)
    }
}
