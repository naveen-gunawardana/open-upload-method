"""Minimal ISO-BMFF (MP4) box tree: parse, edit, serialize.

Only what OQM needs. Container boxes are parsed into children; everything
else is kept as raw payload bytes so unknown data round-trips untouched.
"""

import struct

CONTAINERS = {b"moov", b"trak", b"mdia", b"minf", b"stbl", b"edts", b"dinf", b"udta", b"mvex"}


class Box:
    __slots__ = ("type", "payload", "children", "offset", "header_size")

    def __init__(self, type, payload=b"", children=None, offset=0, header_size=8):
        self.type = type
        self.payload = payload
        self.children = children
        self.offset = offset
        self.header_size = header_size

    def __repr__(self):
        return f"Box({self.type!r}, size={len(self.body())})"

    def body(self):
        if self.children is not None:
            return b"".join(c.serialize() for c in self.children)
        return bytes(self.payload)

    def serialize(self):
        body = self.body()
        size = 8 + len(body)
        if size > 0xFFFFFFFF:
            return struct.pack(">I", 1) + self.type + struct.pack(">Q", size + 8) + body
        return struct.pack(">I", size) + self.type + body

    def find(self, *path):
        """First descendant following a path of box types, or None."""
        node = self
        for t in path:
            if node.children is None:
                return None
            node = next((c for c in node.children if c.type == t), None)
            if node is None:
                return None
        return node

    def find_all(self, t):
        return [c for c in (self.children or []) if c.type == t]

    def walk(self):
        yield self
        for c in self.children or []:
            yield from c.walk()

    def copy(self):
        return parse(self.serialize())[0]


def parse(data, start=0, end=None, base=0):
    """Parse boxes in data[start:end]. Stops at the first malformed header."""
    end = len(data) if end is None else end
    boxes = []
    pos = start
    while pos + 8 <= end:
        size, btype = struct.unpack_from(">I4s", data, pos)
        header = 8
        if size == 1:
            if pos + 16 > end:
                break
            size = struct.unpack_from(">Q", data, pos + 8)[0]
            header = 16
        elif size == 0:
            size = end - pos
        if size < header or pos + size > end:
            break
        if btype in CONTAINERS:
            box = Box(btype, children=parse(data, pos + header, pos + size, base), offset=base + pos, header_size=header)
        else:
            box = Box(btype, payload=memoryview(data)[pos + header:pos + size], offset=base + pos, header_size=header)
        boxes.append(box)
        pos += size
    return boxes


def read_file(path):
    with open(path, "rb") as f:
        data = f.read()
    return data, parse(data)


# --- helpers for specific boxes -------------------------------------------

def u32(b, off):
    return struct.unpack_from(">I", b, off)[0]


def u64(b, off):
    return struct.unpack_from(">Q", b, off)[0]


def full_box(btype, version, flags, payload):
    return Box(btype, payload=struct.pack(">I", (version << 24) | (flags & 0xFFFFFF)) + payload)


def handler_type(trak):
    hdlr = trak.find(b"mdia", b"hdlr")
    return bytes(hdlr.payload[8:12]) if hdlr else b""


def sample_entry_type(trak):
    stsd = trak.find(b"mdia", b"minf", b"stbl", b"stsd")
    if not stsd or len(stsd.payload) < 16:
        return b""
    return bytes(stsd.payload[12:16])


def track_id(trak):
    tkhd = trak.find(b"tkhd")
    p = tkhd.payload
    return u32(p, 12 if p[0] == 0 else 20)


def set_track_id(trak, tid):
    tkhd = trak.find(b"tkhd")
    p = bytearray(tkhd.payload)
    struct.pack_into(">I", p, 12 if p[0] == 0 else 20, tid)
    tkhd.payload = p


def chunk_offset_boxes(moov):
    return [b for b in moov.walk() if b.type in (b"stco", b"co64")]


def shift_chunk_offsets(moov, delta):
    for box in chunk_offset_boxes(moov):
        p = bytearray(box.payload)
        n = u32(p, 4)
        if box.type == b"stco":
            for i in range(n):
                v = u32(p, 8 + 4 * i) + delta
                if not 0 <= v <= 0xFFFFFFFF:
                    raise ValueError("chunk offset out of 32-bit range; file too large for stco")
                struct.pack_into(">I", p, 8 + 4 * i, v)
        else:
            for i in range(n):
                struct.pack_into(">Q", p, 8 + 8 * i, u64(p, 8 + 8 * i) + delta)
        box.payload = p


def tree(boxes, indent=0, out=None):
    """Human-readable box tree (for `oqm inspect`)."""
    out = [] if out is None else out
    for b in boxes:
        size = len(b.body()) + b.header_size if b.type != b"mdat" else len(b.payload) + b.header_size
        extra = ""
        if b.type == b"hdlr":
            extra = f" handler={bytes(b.payload[8:12]).decode('latin-1')}"
        elif b.type == b"stsz":
            extra = f" uniform={u32(b.payload, 4)} samples={u32(b.payload, 8)}"
        elif b.type in (b"stco", b"co64", b"stsc", b"stts"):
            extra = f" entries={u32(b.payload, 4)}"
        elif b.type in (b"mvhd", b"mdhd"):
            p = b.payload
            ts, dur = (u32(p, 12), u32(p, 16)) if p[0] == 0 else (u32(p, 20), u64(p, 24))
            extra = f" v{p[0]} timescale={ts} duration={dur:#x}" if dur > 0xFFFFFFF else f" v{p[0]} timescale={ts} duration={dur}"
        elif b.type == b"tkhd":
            extra = f" id={u32(b.payload, 12 if b.payload[0] == 0 else 20)} flags={u32(b.payload, 0) & 0xFFFFFF}"
        out.append(f"{'  ' * indent}{b.type.decode('latin-1')}  {size:,} B{extra}")
        if b.children is not None:
            tree(b.children, indent + 1, out)
    return out
