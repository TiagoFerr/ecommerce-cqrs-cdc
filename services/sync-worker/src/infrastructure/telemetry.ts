import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { trace, context, propagation, SpanStatusCode, type Span, type Tracer } from '@opentelemetry/api';

let sdk: NodeSDK | null = null;

export function initTelemetry(serviceName: string): Tracer {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

  if (endpoint && !sdk) {
    try {
      const exporter = new OTLPTraceExporter({
        url: `${endpoint.replace(/\/$/, '')}/v1/traces`,
      });

      sdk = new NodeSDK({
        resource: resourceFromAttributes({
          [ATTR_SERVICE_NAME]: serviceName,
        }),
        traceExporter: exporter,
      });

      sdk.start();

      process.on('SIGTERM', () => {
        sdk?.shutdown().catch(() => {});
      });
    } catch (err) {
      console.warn(`[Telemetry] Falha ao inicializar OpenTelemetry SDK para ${serviceName}:`, err);
    }
  }

  return trace.getTracer(serviceName);
}

export { trace, context, propagation, SpanStatusCode };
export type { Span, Tracer };
