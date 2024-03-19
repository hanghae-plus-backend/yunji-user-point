import { IsInt, Min } from 'class-validator'

export class PointBody {
    @IsInt()
    @Min(0)
    amount: number
}
