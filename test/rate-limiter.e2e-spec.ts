import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "./../src/app.module";
import { GenericContainer, StartedTestContainer, Wait } from "testcontainers";

jest.setTimeout(180000);

describe("RateLimiterController (e2e)", () => {
  let app: INestApplication;
  let redisContainer: StartedTestContainer;

  beforeAll(async () => {
    redisContainer = await new GenericContainer("redis:alpine")
      .withExposedPorts(6379)
      .withWaitStrategy(Wait.forLogMessage("Ready to accept connections"))
      .start();

    const redisHost = redisContainer.getHost();
    const redisPort = redisContainer.getMappedPort(6379);

    process.env.REDIS_HOST = redisHost;
    process.env.REDIS_PORT = redisPort.toString();

    console.log(`Redis running at: ${redisHost}:${redisPort}`);

    const testModuleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = testModuleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await redisContainer?.stop();
  });

  it("/rate-limiter/request (POST) should accept the first request", async () => {
    const ipAddress = "127.0.0.1";
    return request(app.getHttpServer())
      .post("/rate-limiter/request")
      .set("X-Forwarded-For", ipAddress)
      .expect(202)
      .then((res) => {
        expect(res.body).toHaveProperty("message", "Request accepted");
        expect(res.body).toHaveProperty("requestId");
      });
  });

  it("should reject requests exceeding the rate limit (5 requests / 60 seconds)", async () => {
    const ipAddress = "192.168.1.100";
    const limit = 5;

    for (let i = 0; i < limit; i++) {
      await request(app.getHttpServer())
        .post("/rate-limiter/request")
        .set("X-Forwarded-For", ipAddress);
    }

    await request(app.getHttpServer())
      .post("/rate-limiter/request")
      .set("X-Forwarded-For", ipAddress)
      .expect(429)
      .then((res) => {
        expect(res.body).toHaveProperty("message", "Rate limit exceeded");
      });
  });
});
