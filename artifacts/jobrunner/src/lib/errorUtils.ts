export interface TradieFriendlyError {
  title: string;
  message: string;
  fix?: string;
}

export function parseTradieFriendlyError(error: any): TradieFriendlyError {
  let errorData: any = null;
  
  if (error?.response?.data) {
    errorData = error.response.data;
  } else if (error?.data) {
    errorData = error.data;
  } else if (error instanceof Error) {
    // Handle format "502: {json}" from apiRequest throwIfResNotOk
    const message = error.message;
    const jsonMatch = message.match(/^\d+:\s*(\{[\s\S]+\})$/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        if (parsed.title || parsed.message) {
          errorData = parsed;
        }
      } catch {
      }
    } else {
      // Try parsing the whole message as JSON
      try {
        const parsed = JSON.parse(message);
        if (parsed.title || parsed.message) {
          errorData = parsed;
        }
      } catch {
      }
    }
  } else if (typeof error === 'string') {
    // Handle string errors with "502: {json}" format
    const jsonMatch = error.match(/^\d+:\s*(\{[\s\S]+\})$/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        if (parsed.title || parsed.message) {
          errorData = parsed;
        }
      } catch {
      }
    }
  }
  
  if (errorData?.title && errorData?.message) {
    return {
      title: errorData.title,
      message: errorData.message,
      fix: errorData.fix
    };
  }
  
  const rawMessage = error?.message || error?.error || String(error);
  
  if (rawMessage.includes('insufficient permission') || rawMessage.includes('oauth') || rawMessage.includes('scope')) {
    return {
      title: "Connection Needed",
      message: "Your account connection needs to be refreshed.",
      fix: "Go to Settings and reconnect your account."
    };
  }
  
  if (rawMessage.includes('network') || rawMessage.includes('timeout') || rawMessage.includes('ECONNREFUSED') || rawMessage.includes('fetch')) {
    return {
      title: "Connection Issue",
      message: "Couldn't connect to the server.",
      fix: "Check your internet connection and try again."
    };
  }
  
  if (rawMessage.includes('401') || rawMessage.includes('unauthorized')) {
    return {
      title: "Session Expired",
      message: "Your login has expired.",
      fix: "Please log in again to continue."
    };
  }
  
  if (rawMessage.includes('403') || rawMessage.includes('forbidden')) {
    return {
      title: "Access Denied",
      message: "You don't have permission to do this.",
      fix: "Contact your account owner if you need access."
    };
  }
  
  if (rawMessage.includes('404') || rawMessage.includes('not found')) {
    return {
      title: "Not Found",
      message: "This item doesn't exist or has been deleted.",
      fix: "Go back and try again, or check if it was removed."
    };
  }
  
  if (rawMessage.includes('rate limit') || rawMessage.includes('429') || rawMessage.includes('too many')) {
    return {
      title: "Too Many Requests",
      message: "You've made too many requests in a short time.",
      fix: "Wait a few minutes and try again."
    };
  }
  
  if (rawMessage.includes('500') || rawMessage.includes('server error')) {
    return {
      title: "Server Error",
      message: "Something went wrong on our end.",
      fix: "Try again in a few minutes. If this keeps happening, go to Settings → Support for help."
    };
  }
  
  return {
    title: "Something Went Wrong",
    message: "We couldn't complete that action.",
    fix: "Try again. If this keeps happening, go to Settings → Support for help."
  };
}

export function formatToastDescription(error: TradieFriendlyError): string {
  if (error.fix) {
    return `${error.message} ${error.fix}`;
  }
  return error.message;
}
