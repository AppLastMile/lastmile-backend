import { ChatController } from './chat.controller';

const makeService = () => ({
  createMessage: jest.fn().mockResolvedValue({
    id: 1,
    campaignId: 1,
    userId: 2,
    message: 'Hello',
    createdAt: new Date(),
  }),
});

describe('ChatController', () => {
  it('createMessage() delegates to service', async () => {
    const service = makeService();
    const controller = new ChatController(service as any);
    const dto = { campaignId: 1, userId: 2, message: 'Hello' } as any;
    const result = await controller.createMessage(dto);
    expect(service.createMessage).toHaveBeenCalledWith(dto);
    expect(result.id).toBe(1);
  });
});
