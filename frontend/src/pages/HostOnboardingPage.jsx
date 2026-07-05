import { useQuery } from '@tanstack/react-query'
import { authService } from '@services/auth.service'
import SEOMeta from '@components/common/SEOMeta'
import OnboardingWizard from '@features/listings/components/onboarding/OnboardingWizard'

export default function HostOnboardingPage() {
  const { data: profile, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => authService.getMe().then((r) => r.data),
  })

  return (
    <>
      <SEOMeta title="List your property" noindex />
      <div className="h-screen flex flex-col bg-slate-50 pt-16">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-brand-600 border-t-transparent animate-spin" />
          </div>
        ) : (
          <OnboardingWizard profile={profile} />
        )}
      </div>
    </>
  )
}
