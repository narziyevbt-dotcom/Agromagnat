import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiConfig } from '../../config/configuration';
import { CatalogModule } from '../catalog/catalog.module';
import { ListingsModule } from '../listings/listings.module';
import { User } from '../users/entities/user.entity';
import { AiController } from './ai.controller';
import { AiFacade } from './ai.facade';
import { AI_SERVICE, AiService } from './ai.types';
import { AnthropicAiService } from './anthropic-ai.service';
import { LocalAiService } from './local-ai.service';

/**
 * Which provider backs `AI_SERVICE` is decided once, at boot, from config.
 *
 * The choice degrades rather than fails: `AI_PROVIDER=anthropic` with no key
 * falls back to the local provider and says so in the log, because a missing
 * key should not take down listing creation on a Friday evening. A misconfigured
 * key is a deploy problem; an unpostable listing is a lost seller.
 */
@Module({
  // ListingsModule for smart search, which runs the parsed filters through the
  // ordinary feed query rather than reimplementing it.
  imports: [TypeOrmModule.forFeature([User]), CatalogModule, ListingsModule],
  controllers: [AiController],
  providers: [
    LocalAiService,
    {
      provide: AI_SERVICE,
      inject: [ConfigService, LocalAiService],
      useFactory: (config: ConfigService, local: LocalAiService): AiService => {
        const ai = config.getOrThrow<AiConfig>('ai');
        const logger = new Logger('AI');

        if (ai.provider === 'anthropic' && ai.anthropicApiKey) {
          logger.log(`Anthropic provider: ${ai.anthropicModel} / ${ai.anthropicFastModel}`);
          return new AnthropicAiService(config, local);
        }

        if (ai.provider === 'anthropic') {
          logger.warn('AI_PROVIDER=anthropic but ANTHROPIC_API_KEY is empty — using keywords');
        } else {
          logger.log('Local keyword provider (no model calls, no cost)');
        }
        return local;
      },
    },
    AiFacade,
  ],
  exports: [AI_SERVICE, AiFacade],
})
export class AiModule {}
