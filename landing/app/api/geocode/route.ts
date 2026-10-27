import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");

  if (!lat || !lon) {
    return NextResponse.json(
      { error: "GPS coordinates (latitude and longitude) are required." },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=jsonv2&addressdetails=1`,
      {
        headers: {
          "User-Agent": "SecureBox-Web/1.0 (contact@securebox.in)",
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: `Geocoding service returned status ${response.status}` },
        { status: 502 }
      );
    }

    const data = await response.json();
    const addr = data?.address || {};

    const parts: string[] = [];
    const road = addr.road || addr.street || addr.pedestrian || addr.footway;
    const neighbourhood = addr.neighbourhood || addr.subdivision;
    const suburb = addr.suburb || addr.residential || addr.city_district || addr.subdistrict;
    const city = addr.city || addr.town || addr.municipality || addr.village || addr.county;

    const addPart = (val?: string) => {
      if (!val) return;
      const trimmed = String(val).trim();
      if (!trimmed) return;
      // Prevent duplicates or repetitive sub-strings
      if (!parts.some((p) => p.toLowerCase() === trimmed.toLowerCase())) {
        parts.push(trimmed);
      }
    };

    addPart(road);
    addPart(neighbourhood);
    addPart(suburb);
    addPart(city);

    const streetAddress = parts.length > 0 ? parts.join(", ") : (data.display_name || "");

    let pincode = "";
    const rawPostcode = addr.postcode || addr.postal_code;
    if (rawPostcode) {
      const digits = String(rawPostcode).replace(/\D/g, "");
      if (digits.length >= 6) {
        pincode = digits.slice(0, 6);
      }
    }

    // If postcode was not in address details, try extracting 6-digit pin from display_name
    if (!pincode && data.display_name) {
      const match = String(data.display_name).match(/\b(\d{6})\b/);
      if (match) {
        pincode = match[1];
      }
    }

    return NextResponse.json({
      streetAddress,
      pincode,
      lat,
      lon,
      rawAddress: addr,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Geocoding failed" }, { status: 500 });
  }
}
