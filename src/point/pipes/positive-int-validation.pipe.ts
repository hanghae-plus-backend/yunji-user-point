import {
    ArgumentMetadata,
    BadRequestException,
    PipeTransform,
} from '@nestjs/common'

export class PositiveIntValidationPipe implements PipeTransform {
    transform(value: any, metadata: ArgumentMetadata) {
        const numberValue = +value
        if (!Number.isInteger(numberValue) || value <= 0) {
            throw new BadRequestException(
                `${metadata.data} is must be positive number.`,
            )
        }

        return numberValue
    }
}
