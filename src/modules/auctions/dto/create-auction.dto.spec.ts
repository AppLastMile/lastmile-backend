import { validate } from 'class-validator';
import { CreateAuctionDto } from './create-auction.dto';

function buildDto(overrides: Partial<CreateAuctionDto> = {}): CreateAuctionDto {
  const dto = new CreateAuctionDto();
  dto.itemName = 'Test Auction Item';
  dto.initialPrice = 100;
  dto.durationMinutes = 60;
  return Object.assign(dto, overrides);
}

describe('CreateAuctionDto — CA3 validation', () => {
  describe('initialPrice', () => {
    it('is valid when initialPrice is a positive integer', async () => {
      const errors = await validate(buildDto({ initialPrice: 1 }));
      const priceErrors = errors.filter((e) => e.property === 'initialPrice');
      expect(priceErrors).toHaveLength(0);
    });

    it('fails when initialPrice is zero', async () => {
      const errors = await validate(buildDto({ initialPrice: 0 }));
      const priceErrors = errors.filter((e) => e.property === 'initialPrice');
      expect(priceErrors.length).toBeGreaterThan(0);
    });

    it('fails when initialPrice is negative', async () => {
      const errors = await validate(buildDto({ initialPrice: -50 }));
      const priceErrors = errors.filter((e) => e.property === 'initialPrice');
      expect(priceErrors.length).toBeGreaterThan(0);
    });

    it('fails when initialPrice is missing', async () => {
      const dto = buildDto();

      delete (dto as any).initialPrice;
      const errors = await validate(dto);
      const priceErrors = errors.filter((e) => e.property === 'initialPrice');
      expect(priceErrors.length).toBeGreaterThan(0);
    });

    it('fails when initialPrice is a decimal number', async () => {
      // @IsInt rejects non-integer values
      const errors = await validate(buildDto({ initialPrice: 10.5 as number }));
      const priceErrors = errors.filter((e) => e.property === 'initialPrice');
      expect(priceErrors.length).toBeGreaterThan(0);
    });
  });

  describe('durationMinutes', () => {
    it('is valid when durationMinutes is a positive integer', async () => {
      const errors = await validate(buildDto({ durationMinutes: 30 }));
      const durationErrors = errors.filter(
        (e) => e.property === 'durationMinutes',
      );
      expect(durationErrors).toHaveLength(0);
    });

    it('fails when durationMinutes is zero', async () => {
      const errors = await validate(buildDto({ durationMinutes: 0 }));
      const durationErrors = errors.filter(
        (e) => e.property === 'durationMinutes',
      );
      expect(durationErrors.length).toBeGreaterThan(0);
    });

    it('fails when durationMinutes is negative', async () => {
      const errors = await validate(buildDto({ durationMinutes: -10 }));
      const durationErrors = errors.filter(
        (e) => e.property === 'durationMinutes',
      );
      expect(durationErrors.length).toBeGreaterThan(0);
    });

    it('fails when durationMinutes is missing', async () => {
      const dto = buildDto();

      delete (dto as any).durationMinutes;
      const errors = await validate(dto);
      const durationErrors = errors.filter(
        (e) => e.property === 'durationMinutes',
      );
      expect(durationErrors.length).toBeGreaterThan(0);
    });
  });

  describe('full valid payload', () => {
    it('passes validation with all required fields correct', async () => {
      const errors = await validate(buildDto());
      expect(errors).toHaveLength(0);
    });

    it('passes validation when itemName is provided', async () => {
      const errors = await validate(
        buildDto({ itemName: 'Generador portatil' }),
      );
      expect(errors).toHaveLength(0);
    });
  });
});
