# Testcontainers Demo

This project demonstrates the usage of Testcontainers for integration testing in a NestJS application.

## What are Testcontainers?

Testcontainers is a library that provides lightweight, throwaway instances of common databases, message brokers, web browsers, or anything else that can run in a Docker container. It allows you to write integration tests that interact with real dependencies without needing to manage external services or mock complex behaviors.

## Why use Testcontainers?

Testcontainers offer several advantages, especially in modern software development:

* **Reliable Integration Testing:** Testcontainers provide real instances of dependencies, ensuring your integration tests accurately reflect how your application interacts with external services in production.
* **Simplified Setup:** They eliminate the need for complex setup scripts or manually managing external services for testing. Testcontainers handle the lifecycle (start, stop, cleanup) of the required containers automatically.
* **Legacy Code Modernization:** When dealing with legacy codebases that are difficult to unit test due to tight coupling or lack of modularity, Testcontainers allow you to write integration tests that cover broader functionalities. This can be a crucial step before undertaking major refactoring efforts, providing a safety net to ensure existing behavior is preserved.
* **Addressing Flaky Tests:** Integration tests relying on shared environments (like a common database instance managed by Docker Compose) can become flaky due to state pollution or conflicts between tests. Testcontainers provide isolated, ephemeral environments for each test run, significantly reducing flakiness and increasing test reliability.
* **Developer Productivity:** Developers can run integration tests locally with the exact same dependencies used in CI, reducing the "it works on my machine" problem.

## The Importance of Integration Testing (and Regression Prevention)

While unit tests are essential for verifying individual components in isolation, integration tests play a critical role in ensuring that different parts of your application work correctly *together*.

* **Verifying Interactions:** Applications are rarely composed of single units. Integration tests validate the communication and data flow between different modules, services, and external dependencies (like databases, message queues, or third-party APIs). They catch issues that unit tests might miss, such as incorrect assumptions about interfaces, data format mismatches, or unexpected side effects from interactions.
* **Confidence in Flows:** Integration tests often cover complete user stories or critical paths through the application (e.g., receiving a request, processing it, storing data, and sending a notification). Passing integration tests provides higher confidence that the system meets its functional requirements from end-to-end.
* **Regression Safety Net in CI/CD:** When run automatically in a Continuous Integration (CI) pipeline, integration tests act as a powerful safety net against regressions. A regression is a bug introduced into code that was previously working, often as an unintended consequence of new changes or refactoring.
    * By running integration tests on every code change (e.g., before merging a pull request or deploying), you can automatically detect if a change has broken existing functionality involving multiple components.
    * Catching these regressions early in the development cycle is significantly cheaper and easier than finding them in production.
    * This automated verification increases confidence in the stability of the codebase and the safety of deployments.

Using tools like Testcontainers makes writing and running *reliable* integration tests much more feasible by providing real, isolated dependencies for each test run.

## Importance for Legacy Code Refactoring

Refactoring legacy code often involves significant changes with a high risk of introducing regressions. Unit tests might be difficult or impossible to write without substantial upfront refactoring. Testcontainers enable you to write higher-level integration tests that verify the system's behavior through its external contracts (e.g., API endpoints, database interactions). These tests act as characterization tests, capturing the current behavior before refactoring begins. As you refactor, these integration tests provide confidence that the core functionality remains intact.

## Importance over Docker Compose for Testing

While Docker Compose is excellent for defining and running multi-container applications, it's often less ideal for integration testing:

* **Shared State:** Using a single `docker-compose.yml` for all tests can lead to shared state between tests, causing flakiness and unpredictability.
* **Lifecycle Management:** Managing the lifecycle of containers defined in Docker Compose within the test execution flow can be cumbersome.

Testcontainers, on the other hand, programmatically manage containers on a per-test or per-test-suite basis, ensuring isolation and simplifying cleanup.

This demo will showcase how to use Testcontainers with NestJS, Redis, and RabbitMQ to test a rate limiter service.

## Integration Testing Setup with Testcontainers (`test/rate-limiter.e2e-spec.ts`)

The `test/rate-limiter.e2e-spec.ts` file contains the integration tests for the rate limiter endpoint. The core of the setup happens within the `beforeAll` block, which uses the Testcontainers library to manage dependencies (Redis and RabbitMQ) for the test run.

Here's a breakdown of the setup process:

1. **Increase Timeout:**

    ```typescript
    jest.setTimeout(180000);
    ```

    Starting Docker containers can take time, so the Jest test timeout is increased to prevent premature failures.

2. **Create Docker Network:**

    ```typescript
    network = await new Network().start();
    ```

    A dedicated Docker network is created. This allows containers to communicate using consistent aliases (like `redis`, `rabbitmq`) instead of dynamic IP addresses.

3. **Start Redis Container:**

    ```typescript
    redisContainer = await new GenericContainer('redis:7-alpine')
      .withExposedPorts(6379)
      .withWaitStrategy(Wait.forLogMessage('Ready to accept connections'))
      .start();
    ```

    * Uses the `redis:7-alpine` Docker image.
    * Exposes the standard Redis port `6379`.
    * Attaches the container to the created `network`.
    * Assigns the network alias `redis`.
    * Uses a `WaitStrategy` to ensure the test waits until Redis logs that it's ready.

4. **Start RabbitMQ Container:**

5. **Retrieve Connection Details:**

    ```typescript
    const redisHost = redisContainer.getHost();
    const redisPort = redisContainer.getMappedPort(6379);
    ```

    Testcontainers maps the container ports (e.g., 6379) to random available ports on the host machine. This code retrieves the actual host IP and dynamically mapped port for each container.

6. **Configure Environment Variables:**

    ```typescript
    process.env.REDIS_HOST = redisHost;
    process.env.REDIS_PORT = redisPort.toString();

    This is a **crucial step**. Before initializing the NestJS application for testing, the environment variables are set to point to the dynamically allocated host and port of the Testcontainers. This ensures the application connects to the temporary container instances, not local or other configured services.
