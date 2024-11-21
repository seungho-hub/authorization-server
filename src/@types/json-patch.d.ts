declare namespace jsonpatch {
  type OpPatch =
    | AddPatch
    | RemovePatch
    | ReplacePatch
    | MovePatch
    | CopyPatch
    | TestPatch;
  interface Patch {
    path: string;
  }
  interface AddPatch extends Patch {
    op: 'add';
    value: string;
  }
  interface RemovePatch extends Patch {
    op: 'remove';
  }
  interface ReplacePatch extends Patch {
    op: 'replace';
    value: string;
  }
  interface MovePatch extends Patch {
    op: 'move';
    from: string;
  }
  interface CopyPatch extends Patch {
    op: 'copy';
    from: string;
  }
  interface TestPatch extends Patch {
    op: 'test';
    value: string;
  }
}

export = jsonpatch;
export as namespace jsonpatch;
