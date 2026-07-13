import express from 'express';

export function createApp({ store, fetchTitle, publicDirectory } = {}) {
  if (!store || !fetchTitle) {
    throw new Error('store and fetchTitle are required');
  }

  const app = express();

  app.use(express.json({ limit: '10kb' }));

  app.get('/api/links', async (_request, response, next) => {
    try {
      response.json(await store.list());
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/links', async (request, response, next) => {
    try {
      const page = await fetchTitle(request.body?.url);
      response.status(201).json(await store.add(page));
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/links/:id', async (request, response, next) => {
    try {
      if (!(await store.remove(request.params.id))) {
        return response.status(404).json({
          error: { code: 'LINK_NOT_FOUND', message: 'Link not found.' },
        });
      }

      return response.sendStatus(204);
    } catch (error) {
      return next(error);
    }
  });

  if (publicDirectory) {
    app.use(express.static(publicDirectory));
  }

  app.use((error, _request, response, _next) => {
    if (error?.type === 'entity.parse.failed') {
      return response.status(400).json({
        error: {
          code: 'INVALID_JSON',
          message: 'Request body must contain valid JSON.',
        },
      });
    }

    if (Number.isInteger(error?.status) && error?.code) {
      return response.status(error.status).json({
        error: { code: error.code, message: error.message },
      });
    }

    console.error(error);

    return response.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred.',
      },
    });
  });

  return app;
}
