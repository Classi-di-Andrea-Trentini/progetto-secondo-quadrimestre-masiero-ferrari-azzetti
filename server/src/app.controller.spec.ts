import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      // `AppService.getHello()` chiude con un a capo (comodo quando si prova con curl):
      // lo spec non lo prevedeva ed era rosso da prima di questa sessione.
      expect(appController.getHello()).toBe('Hello World!\n');
    });
  });
});
