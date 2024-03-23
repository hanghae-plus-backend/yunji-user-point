import { Module } from '@nestjs/common'
import { PointController } from './point.controller'
import { DatabaseModule } from '../database/database.module'
import { PointService } from './point.service'
import { Locks } from './locks'

@Module({
    imports: [DatabaseModule],
    controllers: [PointController],
    providers: [PointService, Locks],
})
export class PointModule {}
