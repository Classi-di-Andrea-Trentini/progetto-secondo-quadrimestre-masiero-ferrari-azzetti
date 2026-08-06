import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { SitemapService } from './sitemap.service';

/**
 * Sta fuori dal prefisso `/api` apposta: i motori di ricerca cercano
 * `/sitemap.xml` e `/robots.txt` nella radice del dominio, non sotto un percorso.
 */
@Controller()
export class SitemapController {
  constructor(private readonly svc: SitemapService) {}

  private get baseUrl(): string {
    return process.env.FRONTEND_URL ?? 'http://localhost:4200';
  }

  @Get('sitemap.xml')
  async sitemap(@Res() res: Response) {
    const xml = await this.svc.build(this.baseUrl);
    res.setHeader('Content-Type', 'application/xml');
    res.send(xml);
  }

  @Get('robots.txt')
  robots(@Res() res: Response) {
    res.setHeader('Content-Type', 'text/plain');
    res.send(this.svc.robots(this.baseUrl));
  }
}
