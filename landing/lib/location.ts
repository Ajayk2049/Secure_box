export interface GeolocationResult {
  streetAddress: string;
  pincode?: string;
  notice?: string;
  error?: string;
}

/**
 * Requests location using the browser geolocation API.
 * Uses high accuracy (GPS / Wi-Fi triangulation) without inaccurate IP estimation.
 */
export async function getCurrentBrowserAddress(): Promise<GeolocationResult> {
  if (typeof window === "undefined" || !navigator.geolocation) {
    return {
      streetAddress: "",
      error: "Location is not supported by your browser.",
    };
  }

  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 15000, // Reuse fresh device GPS reading within 15s to eliminate cold-start delay
      });
    });

    const { latitude, longitude, accuracy } = position.coords;
    console.log(`[GPS] Location resolved: lat=${latitude}, lon=${longitude}, accuracy=±${Math.round(accuracy)}m`);

    const res = await fetch(`/api/geocode?lat=${latitude}&lon=${longitude}`);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return {
        streetAddress: "",
        error: errData.error || "Could not find address for your GPS coordinates.",
      };
    }

    const data = await res.json();
    return {
      streetAddress: data.streetAddress || "",
      pincode: data.pincode,
      notice: data.streetAddress
        ? `Location detected (±${Math.round(accuracy)}m)! Please enter your house/flat number.`
        : undefined,
    };
  } catch (err: any) {
    if (err?.code === 1) {
      return {
        streetAddress: "",
        error: "Location permission was denied. Please allow location access in your browser.",
      };
    }
    if (err?.code === 2) {
      return {
        streetAddress: "",
        error: "Could not acquire precise GPS. Please check that Location is turned ON in Windows / device settings.",
      };
    }
    if (err?.code === 3) {
      return {
        streetAddress: "",
        error: "GPS request timed out. Please try again or enter your address manually.",
      };
    }
    return {
      streetAddress: "",
      error: "Could not retrieve GPS location. Please enter your address manually.",
    };
  }
}
