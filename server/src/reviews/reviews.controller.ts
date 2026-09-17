import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { mkdirSync } from 'fs';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly svc: ReviewsService) {}

  @Get('product/:productId')
  findByProduct(
    @Param('productId') productId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.findByProduct(productId, Number(page) || 1, Number(limit) || 10);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Req() req: any, @Body() dto: CreateReviewDto) {
    const review = await this.svc.create(req.user.id, dto);
    await this.svc.recalcProductRating(dto.productId);
    return review;
  }

  @Post(':id/helpful')
  @UseGuards(JwtAuthGuard)
  voteHelpful(@Req() req: any, @Param('id') id: string) {
    return this.svc.voteHelpful(id, req.user.id);
  }

  @Delete(':id/helpful')
  @UseGuards(JwtAuthGuard)
  removeVote(@Req() req: any, @Param('id') id: string) {
    return this.svc.removeVote(id, req.user.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Req() req: any, @Param('id') id: string) {
    const { productId } = await this.svc.remove(id, req.user.id);
    await this.svc.recalcProductRating(productId);
  }

  /**
   * Foto allegata a una recensione. Riusa lo stesso schema di upload delle immagini
   * prodotto: stessa cartella `uploads`, stesso limite, stesso filtro sul tipo.
   */
  @Post(':id/photos')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = join(process.cwd(), 'uploads', 'reviews');
          mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
          cb(null, `${unique}${extname(file.originalname).toLowerCase()}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        // Il tipo va controllato qui: senza, un `.svg` con dentro uno script
        // finirebbe servito dallo stesso dominio del sito.
        if (!file.mimetype.startsWith('image/') || file.mimetype === 'image/svg+xml') {
          return cb(new BadRequestException('Solo immagini, SVG escluso'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  addPhoto(@Req() req: any, @Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Nessun file ricevuto');
    const backendUrl = process.env['BACKEND_URL'] ?? 'http://localhost:3000';
    return this.svc.addPhoto(req.user.id, id, `${backendUrl}/uploads/reviews/${file.filename}`);
  }

  @Delete(':id/photos')
  @UseGuards(JwtAuthGuard)
  removePhoto(@Req() req: any, @Param('id') id: string, @Body() body: { url: string }) {
    return this.svc.removePhoto(req.user.id, id, body?.url ?? '');
  }
}
