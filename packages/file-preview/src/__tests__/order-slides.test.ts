import { describe, expect, it } from "vitest";
import { orderSlidesByPresentation } from "../pptx/order-slides";

const PRESENTATION_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="..." xmlns:r="...">
  <p:sldIdLst>
    <p:sldId id="256" r:id="rId2"/>
    <p:sldId id="257" r:id="rId1"/>
    <p:sldId id="258" r:id="rId3"/>
  </p:sldIdLst>
</p:presentation>`;

const PRESENTATION_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Target="slides/slide1.xml" Type="..."/>
  <Relationship Id="rId2" Target="slides/slide2.xml" Type="..."/>
  <Relationship Id="rId3" Target="slides/slide3.xml" Type="..."/>
</Relationships>`;

describe("orderSlidesByPresentation", () => {
  it("orders slides by presentation sldIdLst, not filename order", () => {
    const slides = new Map<string, string>([
      ["ppt/slides/slide1.xml", "<xml id='1'/>"],
      ["ppt/slides/slide2.xml", "<xml id='2'/>"],
      ["ppt/slides/slide3.xml", "<xml id='3'/>"],
    ]);

    const ordered = orderSlidesByPresentation(slides, PRESENTATION_XML, PRESENTATION_RELS);

    // rId2 → slide2, rId1 → slide1, rId3 → slide3
    expect(ordered).toEqual([
      "<xml id='2'/>",
      "<xml id='1'/>",
      "<xml id='3'/>",
    ]);
  });

  it("falls back to filename ordering when sldIdLst is missing", () => {
    const slides = new Map<string, string>([
      ["ppt/slides/slide2.xml", "<xml id='2'/>"],
      ["ppt/slides/slide1.xml", "<xml id='1'/>"],
    ]);

    const ordered = orderSlidesByPresentation(slides, "<no-sldIdLst/>", PRESENTATION_RELS);

    expect(ordered).toEqual(["<xml id='1'/>", "<xml id='2'/>"]);
  });

  it("falls back to filename ordering when rels are empty", () => {
    const slides = new Map<string, string>([
      ["ppt/slides/slide2.xml", "<xml id='2'/>"],
      ["ppt/slides/slide1.xml", "<xml id='1'/>"],
    ]);

    const ordered = orderSlidesByPresentation(slides, PRESENTATION_XML, "");

    expect(ordered).toEqual(["<xml id='1'/>", "<xml id='2'/>"]);
  });

  it("skips relationships that do not resolve to a known slide file", () => {
    const slides = new Map<string, string>([
      ["ppt/slides/slide1.xml", "<xml id='1'/>"],
      ["ppt/slides/slide3.xml", "<xml id='3'/>"],
    ]);

    const ordered = orderSlidesByPresentation(slides, PRESENTATION_XML, PRESENTATION_RELS);

    // rId2 is missing slide2.xml; rId1 → slide1, rId3 → slide3
    expect(ordered).toEqual(["<xml id='1'/>", "<xml id='3'/>"]);
  });

  it("normalises ../ prefixes in Target paths", () => {
    const slides = new Map<string, string>([
      ["ppt/slides/slide1.xml", "<xml id='1'/>"],
    ]);

    const relsWithRelative = `<Relationships>
      <Relationship Id="rId1" Target="../ppt/slides/slide1.xml"/>
    </Relationships>`;
    const presWith1 = `<p:presentation><p:sldIdLst>
      <p:sldId r:id="rId1"/>
    </p:sldIdLst></p:presentation>`;

    const ordered = orderSlidesByPresentation(slides, presWith1, relsWithRelative);

    expect(ordered).toEqual(["<xml id='1'/>"]);
  });

  it("returns filename-ordered fallback when rels resolve nothing", () => {
    const slides = new Map<string, string>([
      ["ppt/slides/slide1.xml", "<xml id='1'/>"],
    ]);

    const presWithUnknownRel = `<p:presentation><p:sldIdLst>
      <p:sldId r:id="rId99"/>
    </p:sldIdLst></p:presentation>`;
    const relsForOther = `<Relationships>
      <Relationship Id="rId1" Target="slides/slide1.xml"/>
    </Relationships>`;

    const ordered = orderSlidesByPresentation(slides, presWithUnknownRel, relsForOther);

    // rId99 has no match -> ordered is empty -> falls back to filename ordering
    expect(ordered).toEqual(["<xml id='1'/>"]);
  });
});