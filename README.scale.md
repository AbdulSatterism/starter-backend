Scaling and deployment notes

- Run background queue workers in a separate process: `npm run start:worker`.
- Use managed MongoDB and Redis for production; tune connection pool sizes and timeouts.
- Store uploads in S3-compatible object storage and serve via CDN.
- Use Kubernetes + HorizontalPodAutoscaler for API and worker deployments.
- Add centralized logging (winston -> remote sink) and error tracking (Sentry).
- Use Redis-based rate-limiting for distributed limits.
- Load testing: use k6 or Artillery to simulate traffic.

Local quickstart (docker):

```bash
docker-compose up --build
```
