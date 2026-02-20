import argparse
import json
import math
import os
from datetime import datetime, timezone

import pandas as pd


LON_CANDIDATES = ["longitude", "lon", "lng", "x"]
LAT_CANDIDATES = ["latitude", "lat", "y"]


def _find_col(df_cols, candidates):
    lower = {c.lower(): c for c in df_cols}
    for cand in candidates:
        if cand in lower:
            return lower[cand]
    return None


def _to_float(x):
    try:
        v = float(x)
        if math.isnan(v) or math.isinf(v):
            return None
        return v
    except Exception:
        return None


def _parse_time(value):
    """
    Try to convert dataTime-like values to an ISO-8601 string.
    - If it's already a datetime, format it
    - If it's an integer-like epoch (ms or s), convert it
    - Otherwise return the original value
    """
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return None

    # pandas Timestamp / datetime
    if hasattr(value, "to_pydatetime"):
        dt = value.to_pydatetime()
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()

    # epoch-like numeric
    try:
        iv = int(value)
        # Heuristic: ms epoch usually has 13 digits, s epoch ~10 digits
        if iv > 10_000_000_000:  # likely ms
            dt = datetime.fromtimestamp(iv / 1000.0, tz=timezone.utc)
            return dt.isoformat()
        if iv > 1_000_000_000:  # likely seconds
            dt = datetime.fromtimestamp(iv, tz=timezone.utc)
            return dt.isoformat()
    except Exception:
        pass

    return value


def read_table(path: str) -> pd.DataFrame:
    ext = os.path.splitext(path)[1].lower()
    if ext in [".xlsx", ".xls"]:
        return pd.read_excel(path)
    if ext in [".tsv", ".tab"]:
        return pd.read_csv(path, sep="\t")
    # default to CSV
    return pd.read_csv(path)

def dataframe_to_geojson(
    df: pd.DataFrame,
    lon_col: str,
    lat_col: str,
    nrows: int | None = None,
):
    # Handle negative nrows → take last |nrows| rows
    if nrows is not None:
        if nrows < 0:
            df = df.tail(abs(nrows))
        elif nrows > 0:
            df = df.head(nrows)
        # nrows == 0 → empty result
        else:
            return {"type": "FeatureCollection", "features": []}

    features = []
    for _, row in df.iterrows():
        lon = _to_float(row.get(lon_col))
        lat = _to_float(row.get(lat_col))
        if lon is None or lat is None:
            continue

        props = {}
        for c in df.columns:
            if c in (lon_col, lat_col):
                continue
            v = row.get(c)
            if hasattr(v, "item"):
                v = v.item()
            if c.lower() in ["datatime", "timestamp", "time", "datetime"]:
                v = _parse_time(v)
            if v is None or (isinstance(v, float) and math.isnan(v)):
                continue
            props[c] = v

        features.append(
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [lon, lat],
                },
                "properties": props,
            }
        )

    return {"type": "FeatureCollection", "features": features}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input", help="Input file: .csv / .tsv / .xlsx")
    ap.add_argument("output", help="Output GeoJSON file path")
    ap.add_argument("--lon", default=None, help="Longitude column name (optional)")
    ap.add_argument("--lat", default=None, help="Latitude column name (optional)")
    ap.add_argument(
        "--nrows",
        type=int,
        default=None,
        help="Number of rows to convert (default: all)",
    )
    args = ap.parse_args()

    df = read_table(args.input)

    lon_col = args.lon or _find_col(df.columns, LON_CANDIDATES)
    lat_col = args.lat or _find_col(df.columns, LAT_CANDIDATES)

    if not lon_col or not lat_col:
        raise SystemExit(
            f"Could not find lon/lat columns.\n"
            f"Columns in file: {list(df.columns)}\n"
            f"Try specifying --lon and --lat explicitly."
        )

    gj = dataframe_to_geojson(df, lon_col, lat_col, nrows=args.nrows)

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(gj, f, ensure_ascii=False, indent=2)

    print(f"Wrote {len(gj['features'])} features to: {args.output}")


if __name__ == "__main__":
    main()
