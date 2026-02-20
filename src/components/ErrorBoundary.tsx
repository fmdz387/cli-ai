import { Box, Text } from 'ink';
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    process.stderr.write(
      `Uncaught error: ${error.message}\n${info.componentStack ?? ''}\n`,
    );
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <Box flexDirection="column" paddingY={1}>
          <Text color="red" bold>
            Fatal rendering error
          </Text>
          <Text color="red">{this.state.error.message}</Text>
          {this.state.error.stack && (
            <Box marginTop={1}>
              <Text dimColor>{this.state.error.stack}</Text>
            </Box>
          )}
        </Box>
      );
    }
    return this.props.children;
  }
}
