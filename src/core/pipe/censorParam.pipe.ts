import { ArgumentMetadata, Injectable, Logger, PipeTransform } from "@nestjs/common";

//http参数检查过滤
@Injectable()
export class CensorParamPipe implements PipeTransform {
    protected model
    constructor(model?: any) {
        this.model = model
    }

    transform(value: any, metadata: ArgumentMetadata) {
        const contrastKeys = Object.keys(this.model || new metadata.metatype())
        const valueKeys = Object.keys(value)
        for (let i = 0; i < valueKeys.length; i++) {
            if (!contrastKeys.includes(valueKeys[i])) {
                Logger.log("参数检查" + "  移除多余参数key:" + valueKeys[i])
                delete value[valueKeys[i]]
            }

        }

        return value;
    }
}
