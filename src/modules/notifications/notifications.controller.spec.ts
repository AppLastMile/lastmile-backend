import { NotificationsController } from './notifications.controller';

const makeService = () => ({
  findAll: jest.fn().mockResolvedValue({ data: [], meta: {} }),
  markAsRead: jest.fn().mockResolvedValue({ id: 1, read: true }),
  create: jest.fn().mockResolvedValue({ id: 1, message: 'test' }),
});

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let service: ReturnType<typeof makeService>;

  beforeEach(() => {
    service = makeService();
    controller = new NotificationsController(service as any);
  });

  it('findAll() delegates to service', async () => {
    await controller.findAll({} as any);
    expect(service.findAll).toHaveBeenCalled();
  });

  it('markAsRead() delegates to service', async () => {
    await controller.markAsRead(1);
    expect(service.markAsRead).toHaveBeenCalledWith(1);
  });

  it('createTestForCurrentUser() uses provided message', async () => {
    await controller.createTestForCurrentUser({ userId: 1, role: 'volunteer' }, { message: 'Hello' });
    expect(service.create).toHaveBeenCalledWith(1, 'Hello', null);
  });

  it('createTestForCurrentUser() uses default message when body is empty', async () => {
    await controller.createTestForCurrentUser({ userId: 1, role: 'volunteer' }, {});
    expect(service.create).toHaveBeenCalledWith(1, 'Notificación de prueba', null);
  });

  it('createTestForCurrentUser() uses default when message is whitespace', async () => {
    await controller.createTestForCurrentUser({ userId: 1, role: 'volunteer' }, { message: '   ' });
    expect(service.create).toHaveBeenCalledWith(1, 'Notificación de prueba', null);
  });

  it('createTestForCurrentUser() works without body', async () => {
    await controller.createTestForCurrentUser({ userId: 1, role: 'volunteer' }, undefined);
    expect(service.create).toHaveBeenCalledWith(1, 'Notificación de prueba', null);
  });
});
