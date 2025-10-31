import ComposableNote from "./notation/ComposableNote";

export default function TestNotes() {
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
      <ComposableNote duration="4" head="filled" />
      <ComposableNote duration="8" head="filled" />
      <ComposableNote duration="16" head="filled" />
      <ComposableNote duration="8" head="filled" stemDirection="down" />
      <ComposableNote duration="8" head="filled" flagSide="left" />
      <ComposableNote duration="8" head="filled" stemDirection="down" flagSide="left" />
      <ComposableNote duration="8" head="filled" dotted />
      <ComposableNote duration="2" head="hollow" stemDirection="up" />
    </div>
  );
}
