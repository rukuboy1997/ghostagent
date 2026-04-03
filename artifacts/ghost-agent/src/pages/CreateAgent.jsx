import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useCreateAgent } from "@workspace/api-client-react";
import { Terminal, Shield, Zap, Target, Lock, Unlock, Cpu } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
const formSchema = z.object({
  name: z.string().min(2, "Designation must be at least 2 characters."),
  description: z.string().optional(),
  personality: z.enum(["aggressive", "balanced", "conservative"]),
  capabilities: z.array(z.string()).min(1, "Select at least one capability protocol."),
  isPrivate: z.boolean().default(true)
});
function CreateAgent() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      personality: "balanced",
      capabilities: [],
      isPrivate: true
    }
  });
  const createAgentMutation = useCreateAgent({
    mutation: {
      onSuccess: (data) => {
        toast({
          title: "Operative Initialized",
          description: `GhostAgent ${data.name} is now online in TEE.`
        });
        setLocation(`/agents/${data.id}`);
      },
      onError: () => {
        toast({
          title: "Initialization Failed",
          description: "Could not compile operative profile.",
          variant: "destructive"
        });
      }
    }
  });
  function onSubmit(values) {
    createAgentMutation.mutate({ data: values });
  }
  return <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl mx-auto">
      <div className="border-b border-border/50 pb-4">
        <h2 className="text-2xl font-bold uppercase tracking-widest text-primary flex items-center gap-2">
          <Terminal size={24} /> Initialize New Operative
        </h2>
        <p className="text-muted-foreground text-sm uppercase tracking-wider mt-1">Configure Autonomous TEE Parameters</p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 bg-card/50 p-6 border border-border/50 backdrop-blur relative overflow-hidden">
        <div className="absolute top-0 right-0 p-32 bg-primary/5 blur-[100px] pointer-events-none" />

        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <label className="text-xs uppercase tracking-widest text-primary">Operative Designation</label>
            <input
    {...form.register("name")}
    placeholder="e.g. GHOST-9"
    className="bg-background border border-border/50 p-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all font-mono placeholder:text-muted-foreground"
  />
            {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs uppercase tracking-widest text-primary">Operational Directives (Optional)</label>
            <textarea
    {...form.register("description")}
    placeholder="Describe primary mission objectives..."
    className="bg-background border border-border/50 p-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all font-mono h-24 resize-none placeholder:text-muted-foreground"
  />
          </div>
        </div>

        <div className="space-y-4">
          <label className="text-xs uppercase tracking-widest text-primary">Execution Personality</label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
    { id: "conservative", label: "Conservative", desc: "Prioritizes capital preservation. High confidence thresholds.", icon: <Shield size={18} /> },
    { id: "balanced", label: "Balanced", desc: "Calculated risk-reward. Adaptive strategy.", icon: <Target size={18} /> },
    { id: "aggressive", label: "Aggressive", desc: "Maximum growth vector. High frequency, low latency.", icon: <Zap size={18} /> }
  ].map((p) => {
    const isActive = form.watch("personality") === p.id;
    return <div
      key={p.id}
      onClick={() => form.setValue("personality", p.id)}
      className={`p-4 border cursor-pointer transition-all flex flex-col gap-2 ${isActive ? "border-primary bg-primary/10 shadow-[0_0_15px_rgba(0,212,255,0.15)]" : "border-border/50 bg-background/50 hover:border-primary/50"}`}
    >
                  <div className={`flex items-center gap-2 font-bold uppercase tracking-wider ${isActive ? "text-primary" : "text-foreground"}`}>
                    {p.icon} {p.label}
                  </div>
                  <p className="text-xs text-muted-foreground">{p.desc}</p>
                </div>;
  })}
          </div>
        </div>

        <div className="space-y-4">
          <label className="text-xs uppercase tracking-widest text-primary">Capability Protocols</label>
          <div className="flex flex-wrap gap-3">
            {["trading", "social", "payments", "negotiations", "analysis"].map((cap) => {
    const currentCaps = form.watch("capabilities") || [];
    const isSelected = currentCaps.includes(cap);
    return <div
      key={cap}
      onClick={() => {
        if (isSelected) {
          form.setValue("capabilities", currentCaps.filter((c) => c !== cap));
        } else {
          form.setValue("capabilities", [...currentCaps, cap]);
        }
      }}
      className={`px-4 py-2 border cursor-pointer transition-all text-xs uppercase tracking-widest flex items-center gap-2 ${isSelected ? "border-primary bg-primary text-primary-foreground font-bold" : "border-border/50 bg-background/50 text-muted-foreground hover:border-primary/50 hover:text-foreground"}`}
    >
                  <Cpu size={14} className={isSelected ? "" : "opacity-50"} />
                  {cap}
                </div>;
  })}
          </div>
          {form.formState.errors.capabilities && <p className="text-xs text-destructive">{form.formState.errors.capabilities.message}</p>}
        </div>

        <div className="p-4 border border-border/50 bg-background/50 flex items-center justify-between">
          <div>
            <div className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
              {form.watch("isPrivate") ? <Lock size={16} className="text-green-400" /> : <Unlock size={16} className="text-destructive" />}
              TEE Enclave Privacy
            </div>
            <p className="text-xs text-muted-foreground mt-1">If enabled, all actions and memories are cryptographically sealed.</p>
          </div>
          <div
    onClick={() => form.setValue("isPrivate", !form.watch("isPrivate"))}
    className={`w-12 h-6 border cursor-pointer relative transition-colors ${form.watch("isPrivate") ? "border-green-400 bg-green-400/20" : "border-border bg-muted"}`}
  >
            <div className={`absolute top-0.5 bottom-0.5 w-4 bg-foreground transition-all ${form.watch("isPrivate") ? "left-[calc(100%-1.125rem)] bg-green-400" : "left-0.5"}`} />
          </div>
        </div>

        <button
    type="submit"
    disabled={createAgentMutation.isPending}
    className="w-full p-4 bg-primary text-primary-foreground font-bold uppercase tracking-widest hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 clip-path-slant shadow-[0_0_20px_rgba(0,212,255,0.4)]"
  >
          {createAgentMutation.isPending ? "Compiling..." : "Initialize Operative"}
        </button>
      </form>
    </div>;
}
export {
  CreateAgent as default
};
