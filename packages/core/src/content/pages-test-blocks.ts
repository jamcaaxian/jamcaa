import { defineBlock, type BlockRegistry } from "./blocks";

/** The smallest registry pages tests need, independent of the editor package. */
const divider = defineBlock({ name: "builtin.divider", label: "Divider", props: {} });

const heading = defineBlock({
    name: "builtin.heading",
    label: "Heading",
    props: { level: { kind: "number", label: "Level" } },
    check: props =>
        typeof props.level === "number" && props.level >= 1 && props.level <= 3 ? undefined : "Level must be 1, 2 or 3."
});

export const builtinBlocksForTest: BlockRegistry = { "builtin.divider": divider, "builtin.heading": heading };
