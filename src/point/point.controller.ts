import {
    BadRequestException,
    Body,
    Controller,
    Get,
    InternalServerErrorException,
    Param,
    ParseIntPipe,
    Patch,
    ValidationPipe,
} from '@nestjs/common'
import { PointHistory, UserPoint } from './point.model'
import { PointBody as PointDto } from './point.dto'
import { PointService } from './point.service'
import { PositiveIntValidationPipe } from './pipes/positive-int-validation.pipe'

@Controller('/point')
export class PointController {
    constructor(private pointService: PointService) {}

    /**
     * TODO - 특정 유저의 포인트를 조회하는 기능을 작성해주세요.
     */
    @Get(':id')
    async point(
        @Param('id', PositiveIntValidationPipe) id,
    ): Promise<UserPoint> {
        return this.pointService.getUserPoint(id)
    }

    /**
     * TODO - 특정 유저의 포인트 충전/이용 내역을 조회하는 기능을 작성해주세요.
     */
    @Get(':id/histories')
    async history(
        @Param('id', PositiveIntValidationPipe) id,
    ): Promise<PointHistory[]> {
        return this.pointService.getUserPointHistory(id)
    }

    /**
     * TODO - 특정 유저의 포인트를 충전하는 기능을 작성해주세요.
     */
    @Patch(':id/charge')
    async charge(
        @Param('id', PositiveIntValidationPipe) id,
        @Body(ValidationPipe) pointDto: PointDto,
    ): Promise<UserPoint> {
        return this.pointService.chargeUserPoint(id, pointDto.amount)
    }

    /**
     * TODO - 특정 유저의 포인트를 사용하는 기능을 작성해주세요.
     */
    @Patch(':id/use')
    async use(
        @Param('id', PositiveIntValidationPipe) id,
        @Body(ValidationPipe) pointDto: PointDto,
    ): Promise<UserPoint> {
        return this.pointService.useUserPoint(id, pointDto.amount)
    }
}
