import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-left"
      toastOptions={{
        classNames: {
          toast:
            "group toast toast-shimmer group-[.toaster]:text-white group-[.toaster]:border-0 group-[.toaster]:shadow-lg group-[.toaster]:shadow-indigo-500/25 group-[.toaster]:rounded-full group-[.toaster]:font-bold group-[.toaster]:text-sm group-[.toaster]:px-5 group-[.toaster]:py-2.5 group-[.toaster]:w-auto group-[.toaster]:min-w-0 group-[.toaster]:text-center group-[.toaster]:justify-center",
          description: "group-[.toast]:text-white/70 group-[.toast]:text-[11px]",
          actionButton: "group-[.toast]:bg-white/20 group-[.toast]:text-white group-[.toast]:rounded-full group-[.toast]:font-bold",
          cancelButton: "group-[.toast]:bg-white/10 group-[.toast]:text-white/70 group-[.toast]:rounded-full",
          success: "",
          error: "group-[.toaster]:shadow-red-500/25",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
