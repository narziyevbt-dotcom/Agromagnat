import Anthropic from '@anthropic-ai/sdk';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiConfig } from '../../config/configuration';
import { validateAttributes } from '../catalog/category-forms';
import {
  AiService,
  AssistAnswer,
  AssistTurn,
  CategoryCandidate,
  CategorySuggestion,
  DraftContext,
  ListingDraft,
} from './ai.types';
import { LocalAiService } from './local-ai.service';

/** Above this, the keyword pass is trusted and the model is never called. */
const KEYWORD_CONFIDENCE_FLOOR = 0.75;

/** Every unit the schema will accept — kept in step with `QuantityUnit`. */
const UNITS = ['kg', 't', 'dona', 'quti', 'qop', 'l', 'ga', 'xizmat'];

const SYSTEM_UZ = [
  "Sen Agromagnat — O'zbekiston fermerlari uchun qishloq xo'jaligi bozori — yordamchisisan.",
  "Foydalanuvchilar fermerlar: yoshi 25-60, telefonda yozadi, texnik atamalarni bilmaydi.",
  "Har doim faqat o'zbek tilida, lotin alifbosida, qisqa va sodda javob ber.",
  "Hech qachon narx yoki hajmni o'zingdan to'qima — foydalanuvchi aytmagan bo'lsa bo'sh qoldir.",
].join(' ');

@Injectable()
export class AnthropicAiService implements AiService {
  private readonly logger = new Logger('AI');
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly fastModel: string;

  constructor(
    private readonly config: ConfigService,
    /**
     * Not a test double — the keyword pass answers the easy cases for free and
     * catches every request the API cannot serve. Composition rather than
     * inheritance so the fallback is visible at the call site.
     */
    private readonly local: LocalAiService,
  ) {
    const ai = this.config.getOrThrow<AiConfig>('ai');
    this.client = new Anthropic({ apiKey: ai.anthropicApiKey });
    this.model = ai.anthropicModel;
    this.fastModel = ai.anthropicFastModel;
  }

  // ------------------------------------------------------------- category

  async suggestCategory(text: string, context: DraftContext): Promise<CategorySuggestion> {
    const keyword = await this.local.suggestCategory(text, context);

    // A confident keyword hit is both faster and free. Only ambiguity is worth
    // a model call, and the caller debounces on every keystroke.
    if (keyword.candidates[0]?.confidence >= KEYWORD_CONFIDENCE_FLOOR) {
      return keyword;
    }

    const slugs = context.categories.map((category) => category.slug);

    try {
      const parsed = await this.json<{ slug: string; confidence: number; reasonUz: string }>(
        this.fastModel,
        {
          type: 'object',
          properties: {
            slug: { type: 'string', enum: slugs },
            // No `minimum`/`maximum` here or below: the structured-output
            // schema rejects numeric bounds. Ranges are clamped in code.
            confidence: { type: 'number' },
            reasonUz: { type: 'string' },
          },
          required: ['slug', 'confidence', 'reasonUz'],
          additionalProperties: false,
        },
        `Quyidagi matn qaysi kategoriyaga tegishli?\n\nMatn: "${text}"\n\n` +
          `Kategoriyalar:\n${context.categories
            .map((category) => `- ${category.slug}: ${category.nameUz}`)
            .join('\n')}`,
        256,
      );

      const category = context.categories.find((row) => row.slug === parsed.slug);
      if (!category) return keyword;

      const candidate: CategoryCandidate = {
        categoryId: category.id,
        slug: category.slug,
        nameUz: category.nameUz,
        confidence: Math.min(1, Math.max(0, parsed.confidence)),
        reasonUz: parsed.reasonUz,
      };

      // Keep the keyword runners-up behind the model's pick: they are what the
      // seller reaches for when the model got it wrong.
      const rest = keyword.candidates.filter((row) => row.slug !== candidate.slug);
      return { candidates: [candidate, ...rest].slice(0, 3), source: 'model' };
    } catch (error) {
      this.logger.warn(`suggestCategory fell back to keywords: ${String(error)}`);
      return keyword;
    }
  }

  // ---------------------------------------------------------------- draft

  async draftListing(text: string, context: DraftContext): Promise<ListingDraft> {
    const slugs = context.categories.map((category) => category.slug);

    try {
      const parsed = await this.json<{
        title: string;
        description: string;
        categorySlug: string;
        quantity: number | null;
        quantityUnit: string;
        price: number | null;
        priceUnit: string;
        seasonMonths: number[];
        attributes: Array<{ key: string; value: string }>;
        missingUz: string[];
      }>(
        this.model,
        {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            categorySlug: { type: 'string', enum: slugs },
            quantity: { type: ['number', 'null'] },
            price: { type: ['number', 'null'] },
            // Not nullable, unlike the numbers beside them: a null in an enum's
            // value list is rejected by the schema validator, and there is no
            // need for one — the spec overrides whatever comes back anyway, so
            // the model only has to name a unit that exists.
            quantityUnit: { type: 'string', enum: UNITS },
            priceUnit: { type: 'string', enum: UNITS },
            seasonMonths: { type: 'array', items: { type: 'integer' } },
            // A flat key/value list rather than a per-category object: the
            // schema has to be fixed at request time, and the attribute set is
            // not known until the model has picked the category inside the same
            // response. `validateAttributes` turns it back into a typed bag.
            //
            // Note the absence of length and range keywords throughout this
            // schema. `minLength`, `maxLength`, `minimum`, `maximum` and
            // `maxItems` are all rejected by structured outputs, so every bound
            // is stated in the prompt and enforced on the way out instead.
            attributes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  key: { type: 'string' },
                  value: { type: 'string' },
                },
                required: ['key', 'value'],
                additionalProperties: false,
              },
            },
            missingUz: { type: 'array', items: { type: 'string' } },
          },
          required: [
            'title',
            'description',
            'categorySlug',
            'quantity',
            'quantityUnit',
            'price',
            'priceUnit',
            'seasonMonths',
            'attributes',
            'missingUz',
          ],
          additionalProperties: false,
        },
        this.draftPrompt(text, context),
        2048,
      );

      const category = context.categories.find((row) => row.slug === parsed.categorySlug);
      const spec = category ? context.specFor(category.slug) : null;

      // The model picks the category; the spec decides what units are legal for
      // it. Trusting the model on both would let a tractor be priced per kilo.
      const quantityUnit = this.unitWithin(parsed.quantityUnit, spec?.quantity.units);
      const priceUnit = this.unitWithin(parsed.priceUnit, spec?.price.units);

      // Same validator the listing endpoint uses, so a key the model invented
      // is dropped here rather than rejected at publish time.
      const attributes = spec
        ? validateAttributes(
            spec,
            Object.fromEntries(parsed.attributes.map((row) => [row.key, row.value])),
          ).value
        : {};

      return {
        title: parsed.title.slice(0, 160),
        description: parsed.description,
        categoryId: category?.id ?? null,
        categorySlug: category?.slug ?? null,
        quantity: parsed.quantity,
        quantityUnit,
        price: parsed.price,
        priceUnit,
        regionId: context.regionId ?? null,
        districtId: context.districtId ?? null,
        harvestDate: null,
        seasonMonths: spec?.optional.seasonMonths
          ? parsed.seasonMonths.filter((month) => month >= 1 && month <= 12)
          : [],
        attributes,
        missingUz: parsed.missingUz.slice(0, 8),
        source: 'model',
      };
    } catch (error) {
      this.logger.warn(`draftListing fell back to keywords: ${String(error)}`);
      return this.local.draftListing(text, context);
    }
  }

  // --------------------------------------------------------------- assist

  async assist(question: string, history: AssistTurn[]): Promise<AssistAnswer> {
    try {
      const response = await this.client.messages.create({
        model: this.fastModel,
        max_tokens: 700,
        system: [
          SYSTEM_UZ,
          "Sen faqat Agromagnat va qishloq xo'jaligi savdosi haqida javob berasan.",
          "Javob 120 so'zdan oshmasin. Ro'yxat kerak bo'lsa qisqa qatorlar bilan yoz.",
          "Boshqa mavzudagi savolga: «Men faqat Agromagnat bo'yicha yordam bera olaman» deb javob ber.",
        ].join(' '),
        messages: [
          ...history.slice(-6).map((turn) => ({ role: turn.role, content: turn.content })),
          { role: 'user' as const, content: question },
        ],
      });

      const answer = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('\n')
        .trim();

      return answer
        ? { answerUz: answer, source: 'model' }
        : this.local.assist(question, history);
    } catch (error) {
      this.logger.warn(`assist fell back to canned answers: ${String(error)}`);
      return this.local.assist(question, history);
    }
  }

  // -------------------------------------------------------------- helpers

  private draftPrompt(text: string, context: DraftContext): string {
    const categories = context.categories
      .map((category) => {
        const spec = context.specFor(category.slug);
        if (!spec) return `- ${category.slug}: ${category.nameUz}`;

        const fields = spec.attributes
          .map((def) =>
            def.type === 'select'
              ? `${def.key}=${def.options?.map((option) => option.value).join('|')}`
              : `${def.key}:${def.type}`,
          )
          .join(', ');

        return (
          `- ${category.slug}: ${category.nameUz}` +
          ` (birliklar: ${spec.quantity.units.join(', ')}` +
          `${fields ? `; maydonlar: ${fields}` : ''})`
        );
      })
      .join('\n');

    return [
      "Fermer o'z mahsuloti haqida gapirdi. Uning gapidan e'lon tayyorla.",
      '',
      `Fermer aytdi: "${text}"`,
      '',
      'Kategoriyalar:',
      categories,
      '',
      'Qoidalar:',
      "- title: qisqa, aniq sarlavha (masalan «Urgut pomidori, 1-nav»). Reklama so'zlari ishlatma.",
      "- description: fermer aytgan faktlarni tartibli qilib yoz. Yangi fakt qo'shma.",
      "- quantity/price: fermer aytmagan bo'lsa null qoldir. Taxmin qilma.",
      '- quantityUnit/priceUnit: tanlangan kategoriyaning birliklaridan biri bo\'lsin.',
      "- seasonMonths: mahsulot mavsumi aniq bo'lsa oy raqamlari, aks holda bo'sh.",
      '- attributes: tanlangan kategoriyaning maydonlaridan fermer aytganlarini to\'ldir.',
      "  Aytilmagan maydonni qo'shma. Faqat ro'yxatdagi kalitlarni ishlat.",
      "- missingUz: fermer to'ldirishi kerak bo'lgan maydonlar ro'yxati, o'zbekcha.",
    ].join('\n');
  }

  private unitWithin(unit: string | null, allowed?: string[]): string | null {
    if (!allowed?.length) return unit;
    if (unit && allowed.includes(unit)) return unit;
    return allowed[0];
  }

  /**
   * One structured call. `output_config.format` pins the response to the
   * schema, so a malformed answer is the API's problem rather than a parser's
   * — which is what lets the callers above treat the result as typed data.
   */
  private async json<T>(
    model: string,
    schema: Record<string, unknown>,
    prompt: string,
    maxTokens: number,
  ): Promise<T> {
    const response = await this.client.messages.create({
      model,
      max_tokens: maxTokens,
      system: SYSTEM_UZ,
      output_config: { format: { type: 'json_schema', schema } },
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    return JSON.parse(text) as T;
  }
}
