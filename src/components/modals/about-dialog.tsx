"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, ShieldCheck } from "lucide-react";

interface AboutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AboutDialog({ open, onOpenChange }: AboutDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-slate-900/95 border-slate-800 text-slate-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 text-slate-100">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span>About Bluejay Notes</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-3">
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>License information</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              This project is licensed under the{" "}
              <strong className="text-white font-medium">MIT License</strong>.
            </p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              MIT License — distributed in accordance with free and open source software standards.
            </p>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
